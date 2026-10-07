import { prisma } from "../../lib/prisma.js";
import {
  attendanceTrend,
  avgPresentPercent,
  below80Days,
  buildDayAxis,
  buildOfferedMap,
  buildSchoolDayAxis,
  countSchoolDays,
  dailyPresentPercent,
  formatDateKey,
  groupSectionDay,
  groupSubjectDay,
  isWeekendKey,
  sectionStrictDays,
  type AttendanceStatus,
  type DayAgg,
} from "../attendance.js";
import { rosterCountsByGrade, sectionHeadcounts } from "../enrollment.js";
import { phTodayKey } from "../attendance.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import {
  GRADE_LABEL,
  GRADE_NUMERIC,
  GRADE_ORDER,
  schoolYearClause,
  type DisplayTerm,
} from "../../modules/attendance/attendance.repository.js";

export type HeatSession = "AM" | "PM";

export interface HeatmapQuery {
  session: HeatSession;
  statusFilter: "present" | "late" | "absent" | "excused";
  termId?: string;
  startDate?: Date | null;
}

// Attendance heat map: per-grade, per-day present/total rates split by AM/PM session.
export async function getHeatmap(query: HeatmapQuery) {
  const { session, statusFilter, termId, startDate } = query;
  const where = { session, ...(termId ? { termId } : {}) };

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: {
      date: true,
      status: true,
      student: { select: { gradeLevel: true } },
      roster: { select: { gradeLevel: true } },
    },
    orderBy: { date: "asc" },
  });

  // Authoritative denominator: number of enrolled students per year level
  // (roster-aware — enlisted students without accounts count too).
  const enrolledByGrade: Record<string, number> = {};
  const [enrollCounts, rosterByGrade] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["gradeLevel"],
      _count: { _all: true },
    }),
    rosterCountsByGrade([...GRADE_ORDER] as GradeLevel[]),
  ]);
  for (const e of enrollCounts) enrolledByGrade[e.gradeLevel] = e._count._all;
  for (const [gl, n] of rosterByGrade) enrolledByGrade[gl] = (enrolledByGrade[gl] ?? 0) + n;

  // Build a continuous date axis from the term start date to today (Manila
  // day — the current date's block exists immediately) so every grade card
  // shows the same number of blocks aligned to the same dates.
  const start = startDate
    ? new Date(startDate.toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(phTodayKey() + "T00:00:00Z");
  const axisStart = start ?? records[0]?.date ?? today;
  const dayKeys: string[] = [];
  for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  // Count non-absent records per grade/day. Absent is derived so every
  // enrolled student is accounted for even when a record was never submitted.
  const gradeDayStatus: Record<string, Map<string, { present: number; late: number; excused: number }>> = {};
  for (const r of records) {
    // Roster-marked rows (no account yet) carry the grade from the roster entry.
    const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
    if (!grade) continue;
    const key = r.date.toISOString().slice(0, 10);
    if (!gradeDayStatus[grade]) gradeDayStatus[grade] = new Map();
    if (!gradeDayStatus[grade].has(key)) {
      gradeDayStatus[grade].set(key, { present: 0, late: 0, excused: 0 });
    }
    const cell = gradeDayStatus[grade].get(key)!;
    if (r.status === "present") cell.present++;
    else if (r.status === "late") cell.late++;
    else if (r.status === "excused") cell.excused++;
  }

  const grades = GRADE_ORDER.map((grade) => {
    const statusMap = gradeDayStatus[grade] ?? new Map<string, { present: number; late: number; excused: number }>();
    const total = enrolledByGrade[grade] ?? 0;
    return {
      grade: GRADE_LABEL[grade],
      enrolled: total,
      days: dayKeys.map((key) => {
        const cell = statusMap.get(key) ?? { present: 0, late: 0, excused: 0 };
        // Absent = enrolled − (present + late + excused); never negative.
        const accounted = cell.present + cell.late + cell.excused;
        const absent = Math.max(0, total - accounted);
        const d = new Date(key + "T00:00:00Z");
        const date = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
        return { date, present: cell.present, late: cell.late, absent, excused: cell.excused, total };
      }),
    };
  });

  return { session, status: statusFilter, grades };
}

export interface SummaryQuery {
  session?: HeatSession;
  termId?: string;
}

export async function getSummary(query: SummaryQuery) {
  const { session, termId } = query;
  // Real-time date axis: the last 5 school days (Mon–Fri) ending today
  // (Manila day). Anchored to the current date so the panel always shows
  // today even when no attendance record has been submitted yet.
  const today = new Date(phTodayKey() + "T00:00:00Z");
  const dayKeys: string[] = [];
  for (let d = new Date(today); dayKeys.length < 5; d.setUTCDate(d.getUTCDate() - 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) dayKeys.push(d.toISOString().slice(0, 10));
  }
  dayKeys.reverse();

  const where = {
    ...(termId ? { termId } : {}),
    ...(session ? { session } : {}),
    date: { gte: new Date(dayKeys[0] + "T00:00:00Z") },
  };

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: {
      date: true,
      status: true,
      student: { select: { gradeLevel: true } },
      roster: { select: { gradeLevel: true } },
    },
  });

  const byDay = new Map<string, { present: number; total: number }>();
  const gradeDayAgg: Record<string, Map<string, { present: number; total: number }>> = {};
  const gradeTermAgg: Record<string, { present: number; total: number }> = {};
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);

    if (!byDay.has(key)) byDay.set(key, { present: 0, total: 0 });
    const agg = byDay.get(key)!;
    agg.total += 1;
    if (r.status === "present") agg.present += 1;

    // Roster-marked rows (no account yet) carry the grade from the roster entry.
    const grade = r.student?.gradeLevel ?? r.roster?.gradeLevel;
    if (!grade) continue;
    if (!gradeDayAgg[grade]) gradeDayAgg[grade] = new Map();
    if (!gradeDayAgg[grade].has(key)) gradeDayAgg[grade].set(key, { present: 0, total: 0 });
    const gAgg = gradeDayAgg[grade].get(key)!;
    gAgg.total += 1;
    if (r.status === "present") gAgg.present += 1;

    if (!gradeTermAgg[grade]) gradeTermAgg[grade] = { present: 0, total: 0 };
    gradeTermAgg[grade].total += 1;
    if (r.status === "present") gradeTermAgg[grade].present += 1;
  }

  const trend = dayKeys.map((key) => {
    const agg = byDay.get(key) ?? { present: 0, total: 0 };
    const d = new Date(key + "T00:00:00Z");
    const day = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return { day, present: agg.present, total: agg.total };
  });

  const grades = GRADE_ORDER.filter((g) => gradeTermAgg[g]).map((g) => ({
    grade: GRADE_LABEL[g],
    present: gradeTermAgg[g].present,
    total: gradeTermAgg[g].total,
    days: dayKeys.map((key) => {
      const agg = gradeDayAgg[g]?.get(key) ?? { present: 0, total: 0 };
      const d = new Date(key + "T00:00:00Z");
      const day = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return { day, present: agg.present, total: agg.total };
    }),
  }));

  return { session: session ?? "ALL", trend, grades };
}

export interface SectionHeatmapQuery {
  session: HeatSession;
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

// Per-section daily attendance heatblocks for the CURRENT term (calendar).
// Strict per-day basis: a student counts present for a day only when present
// in EVERY subject offered that weekday (late/absent/excused/unrecorded all
// break the day). Covers every school day from the term start date through
// today — previous terms are never mixed in. The `session` param is accepted
// but ignored on the strict path (subject-era takes carry a placeholder
// session); it only applies to the legacy fallback below when a term holds
// zero subject-era rows (e.g. archived AM/PM terms).
export async function getSectionHeatmap(query: SectionHeatmapQuery) {
  const { session, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: {
      id: true,
      name: true,
      gradeLevel: true,
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  // Roster-aware headcount: enlisted students without accounts count too.
  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  const enrolledBySection: Record<string, number> = {};
  for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;

  // School-day axis: term start -> today, weekends excluded (shared
  // engine). Every block rendered is a school day.
  const dayKeys = buildSchoolDayAxis(displayTerm.startDate);
  const schoolDays = countSchoolDays(dayKeys);

  const sectionIds = sections.map((s) => s.id);
  const subjectTakes = await prisma.attendanceRecord.findMany({
    where: { termId, sectionId: { in: sectionIds }, NOT: { subjectId: null } },
    select: {
      sectionId: true,
      studentId: true,
      rosterId: true,
      subjectId: true,
      date: true,
      status: true,
    },
  });

  if (subjectTakes.length === 0) {
    // Frozen legacy basis (archived AM/PM term): pool raw session takes.
    // Absent is derived (enrolled − present − late − excused).
    const records = await prisma.attendanceRecord.findMany({
      where: { termId, session },
      select: {
        sectionId: true,
        date: true,
        status: true,
      },
    });

    // Aggregation + formatting all come from the generic engine so every
    // attendance surface uses the same date axis, weekend handling, and
    // present/late/excused/absent accounting.
    const dayStatus = groupSectionDay(records);

    const result = sections.map((s) => {
      const statusMap = dayStatus[s.id] ?? new Map();
      const total = enrolledBySection[s.id] ?? 0;
      return {
        sectionId: s.id,
        section: `Grade ${s.name}`,
        gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
        enrolled: total,
        days: dayKeys.map((key) => {
          const cell = statusMap.get(key);
          const present = cell?.present ?? 0;
          const late = cell?.late ?? 0;
          const excused = cell?.excused ?? 0;
          const accounted = present + late + excused;
          const absent = Math.max(0, total - accounted);
          return {
            date: formatDateKey(key),
            isoDate: key,
            present,
            late,
            absent,
            excused,
            total,
            isWeekend: isWeekendKey(key),
            // Canonical daily present ratio (present ÷ headcount), 0..100.
            ratio: dailyPresentPercent(present, total),
          };
        }),
      };
    });

    return {
      session,
      sections: result,
      schoolDays,
      term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
    };
  }

  // Strict path: per-student-day outcomes (present > late > excused >
  // absent) so the four buckets are disjoint and always sum to enrolled.
  const entries = await prisma.sectionTimetableEntry.findMany({
    where: {
      sectionId: { in: sectionIds },
      termId,
      status: { in: ["APPROVED", "SUBMITTED"] },
    },
    select: { sectionId: true, subjectId: true, day: true },
  });
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

  const result = sections.map((s) => {
    const total = enrolledBySection[s.id] ?? 0;
    const sectionDays = strict.get(s.id);
    return {
      sectionId: s.id,
      section: `Grade ${s.name}`,
      gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
      enrolled: total,
      days: dayKeys.map((key) => {
        const cell = sectionDays?.get(key);
        const present = cell?.present.size ?? 0;
        const late = cell?.late.size ?? 0;
        const excused = cell?.excused.size ?? 0;
        const absent = Math.max(0, total - present - late - excused);
        return {
          date: formatDateKey(key),
          isoDate: key,
          present,
          late,
          absent,
          excused,
          total,
          isWeekend: isWeekendKey(key),
          // Canonical daily present ratio (present ÷ headcount), 0..100.
          ratio: dailyPresentPercent(present, total),
        };
      }),
    };
  });

  return {
    session,
    sections: result,
    schoolDays,
    term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
  };
}

export interface SectionStatsQuery {
  session: HeatSession;
  selectedSectionId?: string;
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

// Per-section attendance stats (rate, below-80% days, trend) and the
// school-wide daily attendance trend, for the CURRENT term (calendar) —
// previous terms are never mixed in. Strict per-day basis: a student counts
// present for a day only when present in EVERY subject offered that weekday.
// The `session` param is accepted but ignored on the strict path; it only
// applies to the legacy fallback when a term holds zero subject-era rows.
// amRate/pmRate echo the single daily rate (no session split exists anymore).
export async function getSectionStats(query: SectionStatsQuery) {
  const { session, selectedSectionId, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: { id: true, name: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  // Roster-aware headcount: enlisted students without accounts count too.
  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  const enrolledBySection: Record<string, number> = {};
  for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;
  const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

  // Shared engine: date axis + weekday count from the single source of truth.
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
    // Frozen legacy basis (archived AM/PM term) — original logic unchanged.
    const [raw] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { termId, sectionId: { in: sectionIds } },
        select: { sectionId: true, studentId: true, rosterId: true, date: true, session: true, status: true },
      }),
    ]);

    // Below-80% student count per section (selected session): every enrolled
    // key (LRN-deduped, profile wins) with present/schoolDays < 0.8 —
    // students with zero records count as 0%, same as the per-student view.
    const presentByKey = new Map<string, number>();
    for (const r of raw) {
      if (r.session !== session || r.status !== "present") continue;
      const key = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
      presentByKey.set(`${r.sectionId}|${key}`, (presentByKey.get(`${r.sectionId}|${key}`) ?? 0) + 1);
    }
    const atRiskBySection = new Map<string, number>();
    {
      const registeredLrns = new Map<string, Set<string>>(); // sectionId -> lrns
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

    // Aggregate all records per section/day, then the selected session's ones.
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
        // Canonical attendance % — average present per day ÷ headcount (0..100).
        rate: avgPresentPercent(days, enrolled, schoolDays),
        belowDays: below80Days(days, enrolled),
        amRate: avgPresentPercent(amDays, enrolled, schoolDays),
        pmRate: avgPresentPercent(pmDays, enrolled, schoolDays),
        trend: attendanceTrend(days, enrolled),
        atRiskStudents: atRiskBySection.get(s.id) ?? 0,
      };
    });

    // Daily attendance % trend (present ÷ the relevant headcount, 0..100) for
    // the selected session. Section-wide when a section is selected, otherwise
    // the whole school. Matches the heatblocks' present ÷ headcount ratio.
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

  // Strict path: per-student-day outcomes over subject-era takes.
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

  // Strict present-days per enrolled key (for the at-risk counts below).
  const presentDaysByKey = new Map<string, number>();
  for (const [sectionId, days] of strict) {
    for (const cell of days.values()) {
      for (const key of cell.present) {
        const k = `${sectionId}|${key}`;
        presentDaysByKey.set(k, (presentDaysByKey.get(k) ?? 0) + 1);
      }
    }
  }

  // Below-80% student count per section: every enrolled key (LRN-deduped,
  // profile wins) with strict presentDays/schoolDays < 0.8 — students with
  // zero records count as 0%, same as the per-student view.
  const atRiskBySection = new Map<string, number>();
  {
    const registeredLrns = new Map<string, Set<string>>(); // sectionId -> lrns
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
    // Synthesized day cells: strict present counts; total gates below-80%
    // to days with at least one take (same convention as the legacy path).
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
      // Canonical attendance % — average strict-present per day ÷ headcount.
      rate,
      belowDays: below80Days(days, enrolled),
      // No session split exists on the strict basis — both echo the rate.
      amRate: rate,
      pmRate: rate,
      trend: attendanceTrend(days, enrolled),
      atRiskStudents: atRiskBySection.get(s.id) ?? 0,
    };
  });

  // Daily strict-present % trend (present ÷ the relevant headcount).
  // Section-wide when a section is selected, otherwise the whole school.
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

export interface SessionPatternQuery {
  termId?: string;
  schoolYearId: string | null;
  startDate?: Date | null;
}

// School-wide AM/PM attendance pattern for the session's active term: overall AM/PM
// present rate plus the average present rate per weekday. Powers the "Patterns"
// overlay on the risk heatmaps index. Derived from real attendance records.
export async function getSessionPattern(query: SessionPatternQuery) {
  const { termId, schoolYearId, startDate } = query;
  if (!termId) {
    return { amRate: 0, pmRate: 0, byDay: [] };
  }

  const start = startDate
    ? new Date(startDate.toISOString().slice(0, 10) + "T00:00:00Z")
    : null;
  const today = new Date(phTodayKey() + "T00:00:00Z");
  const axisStart = start ?? today;
  const dayKeys: string[] = [];
  for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: { id: true },
  });
  // Roster-aware headcount: enlisted students without accounts count too.
  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  const enrolledBySection: Record<string, number> = {};
  for (const s of sections) enrolledBySection[s.id] = headcounts.get(s.id) ?? 0;
  const totalEnrolled = Object.values(enrolledBySection).reduce((a, b) => a + b, 0);

  const records = await prisma.attendanceRecord.findMany({
    where: { termId },
    select: { sectionId: true, date: true, session: true, status: true },
  });

  type Cell = { present: number; total: number };
  const am: Record<string, Cell> = {};
  const pm: Record<string, Cell> = {};
  const byWeekday: Record<number, { present: number; total: number }> = {};
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    const target = r.session === "AM" ? am : r.session === "PM" ? pm : null;
    if (target) {
      if (!target[key]) target[key] = { present: 0, total: 0 };
      target[key].total += 1;
      if (r.status === "present") target[key].present += 1;
    }
    const wd = new Date(key + "T00:00:00Z").getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (!byWeekday[wd]) byWeekday[wd] = { present: 0, total: 0 };
    byWeekday[wd].total += 1;
    if (r.status === "present") byWeekday[wd].present += 1;
  }

  const expected = totalEnrolled * dayKeys.length;
  const amPresent = Object.values(am).reduce((a, c) => a + c.present, 0);
  const pmPresent = Object.values(pm).reduce((a, c) => a + c.present, 0);
  const amRate = expected > 0 ? Math.round((amPresent / expected) * 1000) / 10 : 0;
  const pmRate = expected > 0 ? Math.round((pmPresent / expected) * 1000) / 10 : 0;

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const byDay = DAY_NAMES.map((day, i) => {
    const wd = i + 1;
    const cell = byWeekday[wd] ?? { present: 0, total: 0 };
    return {
      day,
      rate: cell.total > 0 ? Math.round((cell.present / cell.total) * 1000) / 10 : 0,
    };
  });

  return { amRate, pmRate, byDay };
}

export interface SubjectPatternQuery {
  sectionId?: string;
  termId?: string;
}

// Per-subject present rates for a section (active term). Replaces the AM/PM
// `session-pattern` comparison for subject-era data: one card per offered
// subject instead of two AM/PM bars.
export async function getSubjectPattern(query: SubjectPatternQuery) {
  const { sectionId, termId } = query;
  if (!termId) {
    return { subjects: [] };
  }
  const records = await prisma.attendanceRecord.findMany({
    where: {
      termId,
      ...(sectionId ? { sectionId } : {}),
      NOT: { subjectId: null },
    },
    select: { subjectId: true, status: true, date: true },
  });
  const subjectIds = [...new Set(records.map((r) => r.subjectId as string))];
  const subjects = subjectIds.length
    ? await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true, code: true },
      })
    : [];
  const nameOf = new Map(subjects.map((s) => [s.id, s]));
  const grouped = groupSubjectDay(records);
  return {
    termId,
    sectionId: sectionId ?? null,
    subjects: [...grouped.entries()].map(([sid, days]) => {
      let present = 0;
      let total = 0;
      for (const cell of days.values()) {
        present += cell.present;
        total += cell.total;
      }
      return {
        subjectId: sid,
        code: nameOf.get(sid)?.code ?? sid,
        name: nameOf.get(sid)?.name ?? sid,
        present,
        total,
        rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      };
    }),
  };
}

export interface SectionSubjectHeatmapQuery {
  subjectId?: string;
  schoolYearId: string | null;
  displayTerm: DisplayTerm;
}

// Per-section, per-day, per-subject heatblocks for the CURRENT term
// (calendar) — previous terms are never mixed in. Each section card renders
// one row per offered subject and one block per day, colored by the canonical
// present ratio (present ÷ headcount). Only subject-era rows (subjectId
// non-null) feed this surface — legacy AM/PM rows stay on the session
// heatmap + archive reads.
export async function getSectionSubjectHeatmap(query: SectionSubjectHeatmapQuery) {
  const { subjectId: subjectFilter, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: { id: true, name: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));
  // School-day axis: term start -> today, weekends excluded. Every block
  // rendered is a school day.
  const dayKeys = buildSchoolDayAxis(displayTerm.startDate);
  const schoolDays = countSchoolDays(dayKeys);

  const [records, offerings] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        termId,
        NOT: { subjectId: null },
        ...(subjectFilter ? { subjectId: subjectFilter } : {}),
      },
      select: { sectionId: true, subjectId: true, date: true, status: true },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: {
        termId,
        ...(subjectFilter ? { subjectId: subjectFilter } : {}),
      },
      select: {
        sectionId: true,
        subjectId: true,
        subject: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  const subjectMeta = new Map<string, { subjectId: string; code: string; name: string }>();
  for (const o of offerings) {
    if (!subjectMeta.has(o.subjectId)) {
      subjectMeta.set(o.subjectId, {
        subjectId: o.subject.id,
        code: o.subject.code,
        name: o.subject.name,
      });
    }
  }
  // Subjects seen in records but missing an assignment row (e.g. legacy
  // imports) still render — code falls back to the id prefix.
  for (const r of records) {
    const sid = r.subjectId as string;
    if (!subjectMeta.has(sid)) {
      subjectMeta.set(sid, { subjectId: sid, code: sid.slice(0, 8), name: sid });
    }
  }

  // Offered subjects per section (assignment-backed), plus any subject
  // with records in that section so nothing recorded is ever hidden.
  const offeredBySection = new Map<string, string[]>();
  for (const o of offerings) {
    const arr = offeredBySection.get(o.sectionId) ?? [];
    if (!arr.includes(o.subjectId)) arr.push(o.subjectId);
    offeredBySection.set(o.sectionId, arr);
  }
  for (const r of records) {
    const arr = offeredBySection.get(r.sectionId) ?? [];
    const sid = r.subjectId as string;
    if (!arr.includes(sid)) arr.push(sid);
    offeredBySection.set(r.sectionId, arr);
  }
  const byCode = (a: string, b: string) =>
    (subjectMeta.get(a)?.code ?? a).localeCompare(subjectMeta.get(b)?.code ?? b);
  for (const arr of offeredBySection.values()) arr.sort(byCode);

  // Aggregate: section -> day -> subject -> counts.
  type Cell = { present: number; late: number; excused: number; total: number };
  const agg = new Map<string, Map<string, Map<string, Cell>>>();
  for (const r of records) {
    const day = r.date.toISOString().slice(0, 10);
    const sid = r.subjectId as string;
    if (!agg.has(r.sectionId)) agg.set(r.sectionId, new Map());
    const days = agg.get(r.sectionId)!;
    if (!days.has(day)) days.set(day, new Map());
    const subs = days.get(day)!;
    if (!subs.has(sid)) subs.set(sid, { present: 0, late: 0, excused: 0, total: 0 });
    const cell = subs.get(sid)!;
    cell.total += 1;
    if (r.status === "present") cell.present++;
    else if (r.status === "late") cell.late++;
    else if (r.status === "excused") cell.excused++;
  }

  const result = sections.map((s) => {
    const enrolled = headcounts.get(s.id) ?? 0;
    const subjectIds = subjectFilter
      ? (offeredBySection.get(s.id) ?? []).filter((id) => id === subjectFilter)
      : (offeredBySection.get(s.id) ?? []);
    const sectionAgg = agg.get(s.id);
    return {
      sectionId: s.id,
      section: `Grade ${s.name}`,
      gradeLevel: GRADE_NUMERIC[s.gradeLevel] ?? s.gradeLevel,
      enrolled,
      subjects: subjectIds.map((id) => subjectMeta.get(id)!),
      days: dayKeys.map((key) => {
        const subs = sectionAgg?.get(key);
        return {
          date: formatDateKey(key),
          isoDate: key,
          isWeekend: isWeekendKey(key),
          cells: subjectIds.map((sid) => {
            const c = subs?.get(sid) ?? { present: 0, late: 0, excused: 0, total: 0 };
            const absent = Math.max(0, enrolled - (c.present + c.late + c.excused));
            return {
              subjectId: sid,
              present: c.present,
              late: c.late,
              absent,
              excused: c.excused,
              total: c.total,
              ratio: dailyPresentPercent(c.present, enrolled),
            };
          }),
        };
      }),
    };
  });

  return {
    sections: result,
    subjects: [...subjectMeta.values()].sort((a, b) => a.code.localeCompare(b.code)),
    schoolDays,
    term: { id: displayTerm.id, termNumber: displayTerm.termNumber },
  };
}
