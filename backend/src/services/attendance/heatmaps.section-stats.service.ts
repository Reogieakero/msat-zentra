import { prisma } from "../../lib/prisma.js";
import {
  attendanceTrend,
  avgPresentPercent,
  below80Days,
  buildDayAxis,
  buildOfferedMap,
  countSchoolDays,
  dailyPresentPercent,
  formatDateKey,
  groupSectionDay,
  sectionStrictDays,
  type AttendanceStatus,
  type DayAgg,
} from "../attendance.js";
import { sectionHeadcounts } from "../enrollment.js";
import { GRADE_NUMERIC, schoolYearClause, type DisplayTerm } from "../../modules/attendance/attendance.repository.js";
import type { HeatSession } from "./heatmaps.grade.service.js";

export interface SectionStatsQuery {
  session: HeatSession;
  selectedSectionId?: string;
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

export async function getSectionStats(query: SectionStatsQuery) {
  const { session, selectedSectionId, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: { id: true, name: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  const enrolledBySection: Record<string, number> = {};
  for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;
  const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

  const dayKeys = buildDayAxis(displayTerm.startDate);
  const schoolDays = countSchoolDays(dayKeys);

  const sectionIds = sections.map((s) => s.id);
  const [subjectTakes, entries, profiles, rosterEntries] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
      select: {
        sectionId: true,
        studentId: true,
        rosterId: true,
        subjectId: true,
        date: true,
        status: true,
      },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId: { in: sectionIds },
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { sectionId: true, subjectId: true, day: true },
    }),
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { userId: true, lrn: true, sectionId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, lrn: true, sectionId: true },
    }),
  ]);

  if (subjectTakes.length === 0) {

    const [raw] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: sectionIds } },
        select: { sectionId: true, studentId: true, rosterId: true, date: true, session: true, status: true },
      }),
    ]);

    const presentByKey = new Map<string, number>();
    for (const r of raw) {
      if (r.session !== session || r.status !== "present") continue;
      const key = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
      presentByKey.set(`${r.sectionId}|${key}`, (presentByKey.get(`${r.sectionId}|${key}`) ?? 0) + 1);
    }
    const atRiskBySection = new Map<string, number>();
    {
      const registeredLrns = new Map<string, Set<string>>();
      const keysBySection = new Map<string, string[]>();
      for (const p of profiles) {
        if (!p.sectionId) continue;
        if (!registeredLrns.has(p.sectionId)) registeredLrns.set(p.sectionId, new Set());
        registeredLrns.get(p.sectionId)!.add(p.lrn);
        if (!keysBySection.has(p.sectionId)) keysBySection.set(p.sectionId, []);
        keysBySection.get(p.sectionId)!.push(`${p.sectionId}|${p.userId}`);
      }
      for (const r of rosterEntries) {
        if (!r.sectionId || registeredLrns.get(r.sectionId)?.has(r.lrn)) continue;
        if (!keysBySection.has(r.sectionId)) keysBySection.set(r.sectionId, []);
        keysBySection.get(r.sectionId)!.push(`${r.sectionId}|roster:${r.id}`);
      }
      for (const [sid, keys] of keysBySection) {
        let n = 0;
        for (const k of keys) {
          const rate = schoolDays > 0 ? (presentByKey.get(k) ?? 0) / schoolDays : 0;
          if (rate < 0.8) n++;
        }
        atRiskBySection.set(sid, n);
      }
    }

    const all = groupSectionDay(raw);
    const sessionMap =
      session === "PM"
        ? groupSectionDay(raw.filter((r) => r.session === "PM"))
        : groupSectionDay(raw.filter((r) => r.session === "AM"));

    const result = sections.map((s) => {
      const enrolled = enrolledBySection[s.id] ?? 0;
      const sm = all[s.id];
      const amMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "AM"))[s.id];
      const pmMap = groupSectionDay(raw.filter((r) => r.sectionId === s.id && r.session === "PM"))[s.id];
      const days: DayAgg[] = dayKeys.map((k) => sm?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
      const amDays: DayAgg[] = dayKeys.map((k) => amMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });
      const pmDays: DayAgg[] = dayKeys.map((k) => pmMap?.get(k) ?? { present: 0, late: 0, excused: 0, total: 0 });

      return {
        sectionId: s.id,
        section: `Grade ${s.name}`,
        gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
        enrolled,

        rate: avgPresentPercent(days, enrolled, schoolDays),
        belowDays: below80Days(days, enrolled),
        amRate: avgPresentPercent(amDays, enrolled, schoolDays),
        pmRate: avgPresentPercent(pmDays, enrolled, schoolDays),
        trend: attendanceTrend(days, enrolled),
        atRiskStudents: atRiskBySection.get(s.id) ?? 0,
      };
    });

    const trend: { date: string; rate: number }[] = dayKeys.map((key) => {
      let present = 0;
      const headcount = selectedSectionId
        ? (enrolledBySection[selectedSectionId] ?? 0)
        : totalEnrolled;
      if (selectedSectionId) {
        present = sessionMap[selectedSectionId]?.get(key)?.present ?? 0;
      } else {
        for (const sectionId of Object.keys(sessionMap)) {
          present += sessionMap[sectionId].get(key)?.present ?? 0;
        }
      }
      return {
        date: formatDateKey(key),
        rate: dailyPresentPercent(present, headcount),
      };
    });

    return {
      sections: result,
      trend,
      schoolDays,
      totalEnrolled,
      term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
    };
  }

  const strict = sectionStrictDays(
    subjectTakes.map((r) => ({
      sectionId: r.sectionId,
      studentKey: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      subjectId: r.subjectId as string,
      date: r.date,
      status: r.status as AttendanceStatus,
    })),
    buildOfferedMap(entries)
  );

  const presentDaysByKey = new Map<string, number>();
  for (const [sectionId, days] of strict) {
    for (const cell of days.values()) {
      for (const key of cell.present) {
        const k = `${sectionId}|${key}`;
        presentDaysByKey.set(k, (presentDaysByKey.get(k) ?? 0) + 1);
      }
    }
  }

  const atRiskBySection = new Map<string, number>();
  {
    const registeredLrns = new Map<string, Set<string>>();
    const keysBySection = new Map<string, string[]>();
    for (const p of profiles) {
      if (!p.sectionId) continue;
      if (!registeredLrns.has(p.sectionId)) registeredLrns.set(p.sectionId, new Set());
      registeredLrns.get(p.sectionId)!.add(p.lrn);
      if (!keysBySection.has(p.sectionId)) keysBySection.set(p.sectionId, []);
      keysBySection.get(p.sectionId)!.push(`${p.sectionId}|${p.userId}`);
    }
    for (const r of rosterEntries) {
      if (!r.sectionId || registeredLrns.get(r.sectionId)?.has(r.lrn)) continue;
      if (!keysBySection.has(r.sectionId)) keysBySection.set(r.sectionId, []);
      keysBySection.get(r.sectionId)!.push(`${r.sectionId}|roster:${r.id}`);
    }
    for (const [sid, keys] of keysBySection) {
      let n = 0;
      for (const k of keys) {
        const rate = schoolDays > 0 ? (presentDaysByKey.get(k) ?? 0) / schoolDays : 0;
        if (rate < 0.8) n++;
      }
      atRiskBySection.set(sid, n);
    }
  }

  const result = sections.map((s) => {
    const enrolled = enrolledBySection[s.id] ?? 0;
    const sectionDays = strict.get(s.id);

    const days: DayAgg[] = dayKeys.map((k) => {
      const cell = sectionDays?.get(k);
      return {
        present: cell?.present.size ?? 0,
        late: 0,
        excused: 0,
        total: (cell?.taken.size ?? 0) > 0 ? enrolled : 0,
      };
    });
    const rate = avgPresentPercent(days, enrolled, schoolDays);

    return {
      sectionId: s.id,
      section: `Grade ${s.name}`,
      gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
      enrolled,

      rate,
      belowDays: below80Days(days, enrolled),

      amRate: rate,
      pmRate: rate,
      trend: attendanceTrend(days, enrolled),
      atRiskStudents: atRiskBySection.get(s.id) ?? 0,
    };
  });

  const trend: { date: string; rate: number }[] = dayKeys.map((key) => {
    let present = 0;
    const headcount = selectedSectionId
      ? (enrolledBySection[selectedSectionId] ?? 0)
      : totalEnrolled;
    if (selectedSectionId) {
      present = strict.get(selectedSectionId)?.get(key)?.present.size ?? 0;
    } else {
      for (const days of strict.values()) {
        present += days.get(key)?.present.size ?? 0;
      }
    }
    return {
      date: formatDateKey(key),
      rate: dailyPresentPercent(present, headcount),
    };
  });

  return {
    sections: result,
    trend,
    schoolDays,
    totalEnrolled,
    term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
  };
}
