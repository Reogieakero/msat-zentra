import { prisma } from "../lib/prisma.js";
import { dailyFromDayCounts, type DayCountCell } from "./attendance.agg.utils.js";
import { isWeekendKey } from "./attendance.date.utils.js";

export interface AttendanceRate {
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  isRisk: boolean;
}

export interface SubjectAttendanceRate extends AttendanceRate {
  subjectId: string | null;

  dailyPresentDays: number | null;
  dailyTotalDays: number | null;
}

export async function computeAttendanceRate(
  studentId: string,
  termId: string
): Promise<AttendanceRate> {
  // Count in SQL. A single student's term can hold thousands of rows, and
  // shipping them all over the pooler just to tally four statuses was the
  // largest single consumer of Supabase egress (~28k rows/call in
  // pg_stat_statements). This returns at most four rows.
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { studentId, termId },
    _count: { _all: true },
  });
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  let total = 0;
  for (const g of grouped) {
    counts[g.status] += g._count._all;
    total += g._count._all;
  }
  const rate = total === 0 ? 1 : counts.present / total;
  return {
    ...counts,
    total,
    rate,
    isRisk: rate < 0.8,
  };
}

export async function computeSubjectAttendanceRate(
  who: { studentId: string } | { rosterId: string },
  termId: string,
  subjectId?: string
): Promise<SubjectAttendanceRate> {
  // Grouped by (status, date) so the daily roll-up needs no raw rows either:
  // the result is at most #schoolDays × 4 rows instead of one row per take.
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["status", "date"],
    where: {
      ...who,
      termId,
      ...(subjectId ? { subjectId } : { NOT: { subjectId: null } }),
    },
    _count: { _all: true },
  });
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  const byDay = new Map<string, DayCountCell>();
  let total = 0;
  for (const g of grouped) {
    const n = g._count._all;
    counts[g.status] += n;
    total += n;
    if (subjectId) continue;
    const day = g.date.toISOString().slice(0, 10);
    if (isWeekendKey(day)) continue;
    const cell = byDay.get(day) ?? { present: 0, total: 0, absent: 0 };
    cell.total += n;
    if (g.status === "present") cell.present += n;
    else cell.absent += n;
    byDay.set(day, cell);
  }
  const rate = total === 0 ? 1 : counts.present / total;

  let dailyPresentDays: number | null = null;
  let dailyTotalDays: number | null = null;
  if (!subjectId && total > 0) {
    const expected = await countOfferedSubjectsFor(who, termId);
    const daily = dailyFromDayCounts(byDay, expected);
    dailyPresentDays = daily.presentDays;
    dailyTotalDays = daily.totalDays;
  }
  return {
    ...counts,
    total,
    rate,
    isRisk: rate < 0.8,
    subjectId: subjectId ?? null,
    dailyPresentDays,
    dailyTotalDays,
  };
}

async function countOfferedSubjectsFor(
  who: { studentId: string } | { rosterId: string },
  termId: string
): Promise<number> {
  const holder =
    "studentId" in who
      ? await prisma.studentProfile.findUnique({
          where: { userId: who.studentId },
          select: { sectionId: true },
        })
      : await prisma.studentRoster.findUnique({
          where: { id: who.rosterId },
          select: { sectionId: true },
        });
  if (!holder?.sectionId) return 0;
  const offered = await prisma.teacherSubjectAssignment.groupBy({
    by: ["subjectId"],
    where: { sectionId: holder.sectionId, termId },
  });
  return offered.length;
}

export interface SubjectAverageEntry {

  average: number;

  hasSubjectData: boolean;
}

export const ATTENDANCE_RISK_CUTOFF = 0.8;

export async function subjectAverageAttendance(
  sectionIds: string[],
  termId: string
): Promise<Map<string, SubjectAverageEntry>> {
  const empty = new Map<string, SubjectAverageEntry>();
  if (sectionIds.length === 0) return empty;
  const [entries, term, records, profiles, rosters] = await Promise.all([
    prisma.sectionTimetableEntry.findMany({
      where: {
        sectionId: { in: sectionIds },
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
      },
      select: { sectionId: true, subjectId: true, day: true },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { sectionId: { in: sectionIds }, termId, NOT: { subjectId: null } },
      select: {
        studentId: true,
        rosterId: true,
        subjectId: true,
        sectionId: true,
        status: true,
        date: true,
      },
    }),
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { userId: true, sectionId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, sectionId: true },
    }),
  ]);

  const meetups = new Map<string, number[]>();
  for (const e of entries) {
    const k = `${e.sectionId}|${e.subjectId}`;
    const arr = meetups.get(k) ?? [];
    if (!arr.includes(e.day)) arr.push(e.day);
    meetups.set(k, arr);
  }

  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (() => {
    if (!term?.endDate) return todayStr;
    const termEnd = term.endDate.toISOString().slice(0, 10);
    return termEnd < todayStr ? termEnd : todayStr;
  })();
  const elapsed = new Map<string, Set<string>>();
  if (startStr && startStr <= endStr) {
    for (const [k, days] of meetups) {
      const set = new Set<string>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (days.includes(day)) set.add(d.toISOString().slice(0, 10));
      }
      if (set.size > 0) elapsed.set(k, set);
    }
  }
  if (elapsed.size === 0) return empty;

  const offeredBySection = new Map<string, string[]>();
  for (const k of elapsed.keys()) {
    const [sectionId, subjectId] = k.split("|");
    const arr = offeredBySection.get(sectionId) ?? [];
    arr.push(subjectId);
    offeredBySection.set(sectionId, arr);
  }
  const sectionOf = new Map<string, string>();
  for (const p of profiles) sectionOf.set(p.userId, p.sectionId as string);
  for (const r of rosters) sectionOf.set(`roster:${r.id}`, r.sectionId);

  const present = new Map<string, Set<string>>();
  const touched = new Set<string>();
  for (const r of records) {
    const subjectId = r.subjectId as string;
    const studentKey = r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
    touched.add(studentKey);
    if (r.status !== "present") continue;
    const k = `${studentKey}|${r.sectionId}|${subjectId}`;
    let set = present.get(k);
    if (!set) {
      set = new Set();
      present.set(k, set);
    }
    set.add(r.date.toISOString().slice(0, 10));
  }

  const result = new Map<string, SubjectAverageEntry>();
  for (const [studentKey, sectionId] of sectionOf) {
    const offered = offeredBySection.get(sectionId) ?? [];
    if (offered.length === 0) continue;
    let sum = 0;
    for (const subjectId of offered) {
      const dates = elapsed.get(`${sectionId}|${subjectId}`);
      if (!dates || dates.size === 0) continue;
      const presentDates = present.get(`${studentKey}|${sectionId}|${subjectId}`);
      let n = 0;
      for (const d of presentDates ?? []) if (dates.has(d)) n += 1;
      sum += n / dates.size;
    }
    result.set(studentKey, {
      average: sum / offered.length,
      hasSubjectData: touched.has(studentKey),
    });
  }
  return result;
}
