import { prisma } from "../../lib/prisma.js";
import { phTodayKey } from "../attendance.date.utils.js";
import type { TeacherContext } from "./teacher.types.js";

/**
 * Day-by-day detection series for the teacher overview charts.
 *
 * Two sources, both scoped to the same learner population:
 * - `RiskSnapshot` (hourly rows) → count High/Moderate/Low per calendar day,
 *   keeping only the latest snapshot per learner per day.
 * - `AttendanceRecord` (per-subject + legacy AM/PM rows) → one status per
 *   learner per day using the worst-of-the-day rank (absent > late > excused >
 *   present), the same rule the attendance sheet uses.
 *
 * Terms without an advisory section use the teacher's assigned + timetable
 * linked sections instead, so non-advisers still get a chart.
 */

export const OVERVIEW_INSIGHTS_DEFAULT_DAYS = 14;
const MAX_DAYS = 30;

/** Worst-of-the-day ranking (higher wins), mirrored from overview-students. */
const DAY_RANK: Record<string, number> = { present: 0, excused: 1, late: 2, absent: 3 };
const RANK_STATUS = ["present", "excused", "late", "absent"] as const;

export interface OverviewInsightDay {
  date: string;
  label: string;
  /*
   * riskTrend fields
   */
  high: number;
  moderate: number;
  low: number;
  tracked: number;
  /*
   * attendanceTrend fields
   */
  present: number;
  late: number;
  absent: number;
  excused: number;
  marked: number;
  rate: number | null;
}

export interface TeacherOverviewInsights {
  days: number;
  rangeStart: string | null;
  rangeEnd: string | null;
  sectionId: string | null;
  sectionName: string | null;
  populationLabel: "advisees" | "students";
  learnerCount: number;
  /** Per-school-day series (weekends skipped), oldest first. */
  series: OverviewInsightDay[];
  /**
   * Latest risk level per learner inside the window. `unassessed` are learners
   * with no snapshot yet, so the donut can total `learnerCount` honestly.
   */
  riskMix: {
    high: number;
    moderate: number;
    low: number;
    unassessed: number;
  };
  totals: {
    high: number;
    moderate: number;
    low: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number | null;
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortLabel(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Last `days` calendar days ending at min(Manila today, term end), weekends
 * dropped and never before the term start. For a past term this anchors on
 * its end date instead of today, so the window cannot drift outside it.
 */
function buildAxis(
  days: number,
  termStart?: Date | null,
  termEnd?: Date | null,
): string[] {
  const keys: string[] = [];
  const today = new Date(`${phTodayKey()}T00:00:00Z`);
  const end = termEnd ? new Date(`${dayKey(new Date(termEnd))}T00:00:00Z`) : null;
  const anchor = end && end < today ? end : today;
  const lower = termStart
    ? new Date(`${dayKey(new Date(termStart))}T00:00:00Z`)
    : null;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(anchor.getTime() - offset * 86_400_000);
    if (lower && d < lower) continue;
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    keys.push(dayKey(d));
  }
  return keys;
}

/**
 * Sections the insights cover: the advisory section when the teacher is an
 * adviser, otherwise the assigned + timetable-linked sections.
 */
async function resolveScopeSections(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) return null;

  const advisory = await prisma.section.findFirst({
    where: { adviserId: teacherId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (advisory) {
    return {
      sectionId: advisory.id as string | null,
      sectionName: advisory.name as string | null,
      sectionIds: [advisory.id],
      populationLabel: "advisees" as const,
    };
  }

  const [assignments, linked] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, termId },
      select: { sectionId: true },
    }),
    prisma.sectionTimetableEntry.findMany({
      where: {
        termId,
        status: { in: ["APPROVED", "SUBMITTED"] },
        teacherName: { userId: teacherId },
      },
      select: { sectionId: true },
    }),
  ]);
  const sectionIds = Array.from(
    new Set([
      ...assignments.map((a) => a.sectionId),
      ...linked.map((l) => l.sectionId),
    ]),
  );
  if (sectionIds.length === 0) {
    return {
      sectionId: null,
      sectionName: null,
      sectionIds: [] as string[],
      populationLabel: "students" as const,
    };
  }
  return {
    sectionId: null as string | null,
    sectionName: null as string | null,
    sectionIds,
    populationLabel: "students" as const,
  };
}

export async function getOverviewInsights(
  ctx: TeacherContext,
  daysParam?: number,
): Promise<TeacherOverviewInsights> {
  const days = Math.min(
    MAX_DAYS,
    Math.max(7, Math.floor(Number(daysParam) || OVERVIEW_INSIGHTS_DEFAULT_DAYS)),
  );
  const term = ctx.termId
    ? await prisma.term.findUnique({
        where: { id: ctx.termId },
        select: { startDate: true, endDate: true },
      })
    : null;
  const axis = buildAxis(days, term?.startDate ?? null, term?.endDate ?? null);
  const empty: TeacherOverviewInsights = {
    days,
    rangeStart: axis[0] ?? null,
    rangeEnd: axis[axis.length - 1] ?? null,
    sectionId: null,
    sectionName: null,
    populationLabel: "students",
    learnerCount: 0,
    series: [],
    riskMix: { high: 0, moderate: 0, low: 0, unassessed: 0 },
    totals: {
      high: 0,
      moderate: 0,
      low: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      attendanceRate: null,
    },
  };
  if (!ctx.termId || axis.length === 0) return empty;

  const scope = await resolveScopeSections(ctx);
  if (!scope || scope.sectionIds.length === 0) {
    return {
      ...empty,
      sectionId: scope?.sectionId ?? null,
      sectionName: scope?.sectionName ?? null,
      populationLabel: scope?.populationLabel ?? "students",
    };
  }

  const [profiles, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: scope.sectionIds } },
      select: { userId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: scope.sectionIds } },
      select: { id: true },
    }),
  ]);
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterEntries.map((r) => r.id);
  const learnerCount = profileIds.length + rosterIds.length;
  if (learnerCount === 0) {
    return {
      ...empty,
      sectionId: scope.sectionId,
      sectionName: scope.sectionName,
      populationLabel: scope.populationLabel,
    };
  }

  const start = new Date(`${axis[0]}T00:00:00.000Z`);
  const learnerOr = [
    ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
    ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
  ];

  const [snapshots, attendance] = await Promise.all([
    prisma.riskSnapshot.findMany({
      where: {
        termId: ctx.termId,
        snapshotDate: { gte: start },
        OR: learnerOr,
      },
      select: {
        studentId: true,
        rosterId: true,
        riskLevel: true,
        snapshotDate: true,
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        termId: ctx.termId,
        sectionId: { in: scope.sectionIds },
        date: { gte: start },
        OR: learnerOr,
      },
      select: {
        studentId: true,
        rosterId: true,
        status: true,
        date: true,
      },
    }),
  ]);

  // Latest snapshot per learner per day: at most one snapshot row is counted
  // on a given day, otherwise a learner would inflate the count hourly.
  const latestSnapshot = new Map<string, { at: number; level: string }>();
  for (const s of snapshots) {
    const learner = s.studentId ?? (s.rosterId ? `roster:${s.rosterId}` : null);
    if (!learner) continue;
    const key = `${learner}|${dayKey(s.snapshotDate)}`;
    const at = s.snapshotDate.getTime();
    const prev = latestSnapshot.get(key);
    if (!prev || at > prev.at) latestSnapshot.set(key, { at, level: s.riskLevel });
  }

  const levelCounts = new Map<string, { high: number; moderate: number; low: number }>();
  for (const [key, snap] of latestSnapshot) {
    const date = key.slice(key.indexOf("|") + 1);
    const cell = levelCounts.get(date) ?? { high: 0, moderate: 0, low: 0 };
    if (snap.level === "High") cell.high += 1;
    else if (snap.level === "Moderate") cell.moderate += 1;
    else cell.low += 1;
    levelCounts.set(date, cell);
  }

  // Current mix = latest snapshot per learner across the whole window.
  const latestByLearner = new Map<string, { at: number; level: string }>();
  for (const [key, snap] of latestSnapshot) {
    const learner = key.slice(0, key.indexOf("|"));
    const prev = latestByLearner.get(learner);
    if (!prev || snap.at > prev.at) latestByLearner.set(learner, snap);
  }
  const riskMix = { high: 0, moderate: 0, low: 0, unassessed: 0 };
  for (const snap of latestByLearner.values()) {
    if (snap.level === "High") riskMix.high += 1;
    else if (snap.level === "Moderate") riskMix.moderate += 1;
    else riskMix.low += 1;
  }
  riskMix.unassessed = Math.max(0, learnerCount - latestByLearner.size);

  // Worst-of-the-day attendance per learner, then count learners per status.
  const worstByLearnerDay = new Map<string, number>();
  for (const r of attendance) {
    const learner = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (!learner) continue;
    const key = `${learner}|${dayKey(r.date)}`;
    const rank = DAY_RANK[r.status] ?? 3;
    worstByLearnerDay.set(key, Math.max(worstByLearnerDay.get(key) ?? -1, rank));
  }
  const attendanceCounts = new Map<string, number[]>();
  for (const [key, rank] of worstByLearnerDay) {
    const date = key.slice(key.indexOf("|") + 1);
    const cell = attendanceCounts.get(date) ?? [0, 0, 0, 0];
    cell[rank] += 1;
    attendanceCounts.set(date, cell);
  }

  const series: OverviewInsightDay[] = axis.map((date) => {
    const levels = levelCounts.get(date) ?? { high: 0, moderate: 0, low: 0 };
    const marks = attendanceCounts.get(date) ?? [0, 0, 0, 0];
    const [present, excused, late, absent] = marks;
    const marked = present + excused + late + absent;
    return {
      date,
      label: shortLabel(date),
      high: levels.high,
      moderate: levels.moderate,
      low: levels.low,
      tracked: levels.high + levels.moderate + levels.low,
      present,
      late,
      absent,
      excused,
      marked,
      rate: marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
    };
  });

  const totals = series.reduce(
    (acc, d) => ({
      high: acc.high + d.high,
      moderate: acc.moderate + d.moderate,
      low: acc.low + d.low,
      present: acc.present + d.present,
      late: acc.late + d.late,
      absent: acc.absent + d.absent,
      excused: acc.excused + d.excused,
    }),
    { high: 0, moderate: 0, low: 0, present: 0, late: 0, absent: 0, excused: 0 },
  );
  const markedTotal = totals.present + totals.late + totals.absent + totals.excused;

  return {
    days,
    rangeStart: series[0]?.date ?? null,
    rangeEnd: series[series.length - 1]?.date ?? null,
    sectionId: scope.sectionId,
    sectionName: scope.sectionName,
    populationLabel: scope.populationLabel,
    learnerCount,
    series,
    riskMix,
    totals: {
      ...totals,
      attendanceRate:
        markedTotal > 0
          ? Math.round((totals.present / markedTotal) * 1000) / 10
          : null,
    },
  };
}

// Kept exported for tests that need to assert the rank order.
export { RANK_STATUS };
