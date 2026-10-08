import { prisma } from "../../lib/prisma.js";
import {
  buildSchoolDayAxis,
  countSchoolDays,
  dailyPresentPercent,
  formatDateKey,
  groupSubjectDay,
  isWeekendKey,
} from "../attendance.js";
import { sectionHeadcounts } from "../enrollment.js";
import { phTodayKey } from "../attendance.js";
import { GRADE_NUMERIC, schoolYearClause, type DisplayTerm } from "../../modules/attendance/attendance.repository.js";

export interface SessionPatternQuery {
  termId?: string;
  schoolYearId: string | null;
  startDate?: Date | null;
}

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

export async function getSectionSubjectHeatmap(query: SectionSubjectHeatmapQuery) {
  const { subjectId: subjectFilter, schoolYearId, displayTerm } = query;
  const termId = displayTerm.id;

  const sections = await prisma.section.findMany({
    where: schoolYearClause(schoolYearId),
    select: { id: true, name: true, gradeLevel: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  const headcounts = await sectionHeadcounts(sections.map((s) => s.id));

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

  for (const r of records) {
    const sid = r.subjectId as string;
    if (!subjectMeta.has(sid)) {
      subjectMeta.set(sid, { subjectId: sid, code: sid.slice(0, 8), name: sid });
    }
  }

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
