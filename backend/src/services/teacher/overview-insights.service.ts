import { prisma } from "../../lib/prisma.js";
import { phTodayKey } from "../attendance.date.utils.js";
import { attendanceTotalFor, computeRiskFactors, levelFromFlags, sectionAttendanceTotals } from "../risk.js";
import { ATTENDANCE_RISK_CUTOFF, subjectAverageAttendance, termHasStarted } from "../attendance.js";
import { admExemptStudentIds } from "../adm/attendancePolicy.js";
import { sectionHeadcounts } from "../enrollment.js";
import { archivedAdvisoryLearnerIds } from "../../lib/learnerVisibility.js";
import type { TeacherContext } from "./teacher.types.js";

/**
 * Day-by-day detection series for the teacher overview charts.
 *
 * Two sources, both scoped to the same learner population:
 * - Live risk factors (the advisory board's derivation) → the current
 *   High/Moderate/Low mix, and `RiskSnapshot` (hourly rows) → count
 *   High/Moderate/Low per calendar day, keeping only the latest snapshot per
 *   learner per day. Days before a learner's first snapshot fall back to the
 *   live level, so a learner whose flags never changed still appears instead
 *   of reading "unassessed".
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
   * Current level per learner, derived live from the same factors the adviser
   * board uses (grades < 75, attendance < 80%, ≥1 anecdote) — never the
   * persisted `riskLevel`, which lags behind until the hourly engine runs.
   * Every learner in scope gets a level, so `unassessed` stays 0 (kept for the
   * client contract).
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
 * Sections the insights cover: the teacher's advisory sections for the selected
 * school year when they are an adviser, otherwise the assigned +
 * timetable-linked sections. Kept in step with the advisory board's
 * `adviserSectionsOr404` so both desks count the same learners.
 */
async function resolveScopeSections(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  const termId = ctx.termId;
  if (!termId) return null;

  const advisory = await prisma.section.findMany({
    where: {
      adviserId: teacherId,
      ...(ctx.schoolYearId ? { schoolYearId: ctx.schoolYearId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (advisory.length > 0) {
    return {
      sectionId: advisory[0]!.id as string | null,
      sectionName: advisory[0]!.name as string | null,
      sectionIds: advisory.map((s) => s.id),
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

  // Same population the advisory board shows: archived learners hidden, and a
  // roster entry whose LRN already has an account is not counted twice.
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const archivedStudentIds = new Set(archivedLearners.studentIds);
  const archivedRosterIds = new Set(archivedLearners.rosterIds);

  const [profileRows, rosterRows] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: scope.sectionIds } },
      select: { userId: true, lrn: true, sectionId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: scope.sectionIds } },
      select: { id: true, lrn: true, sectionId: true },
    }),
  ]);
  const profiles = profileRows.filter((p) => !archivedStudentIds.has(p.userId));
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterEntries = rosterRows.filter(
    (r) => !archivedRosterIds.has(r.id) && !registeredLrns.has(r.lrn),
  );

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

  const sectionIdOf = new Map<string, string>();
  for (const p of profiles) {
    if (p.sectionId) sectionIdOf.set(p.userId, p.sectionId);
  }
  for (const r of rosterEntries) {
    sectionIdOf.set(`roster:${r.id}`, r.sectionId);
  }

  // Section headcounts exactly as the advisory board reads them (`enrolled` is
  // the attendance denominator for account holders), so the flags match.
  const enrolledBySection = await sectionHeadcounts(
    scope.sectionIds,
    profileRows
      .filter((p) => !!p.sectionId)
      .reduce(
        (groups, p) => {
          const existing = groups.find((g) => g.sectionId === p.sectionId);
          if (existing) existing._count._all += 1;
          else groups.push({ sectionId: p.sectionId, _count: { _all: 1 } });
          return groups;
        },
        [] as { sectionId: string | null; _count: { _all: number } }[],
      ),
  );

  const start = new Date(`${axis[0]}T00:00:00.000Z`);
  const learnerOr = [
    ...(profileIds.length > 0 ? [{ studentId: { in: profileIds } }] : []),
    ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
  ];

  const [
    snapshots,
    attendance,
    finalGrades,
    rawRows,
    attendanceMarks,
    anecdotalRows,
    sectionTotals,
    subjectAvgs,
    admExempt,
  ] = await Promise.all([
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
    // Current-level inputs, derived exactly like the advisory board's live
    // risk so the donut and the board can never disagree.
    prisma.finalGrade.findMany({
      where: { termId: ctx.termId, OR: learnerOr },
      select: {
        studentId: true,
        rosterId: true,
        computedAverage: true,
        transmutedGrade: true,
      },
    }),
    prisma.studentGrade.findMany({
      where: {
        assessment: { gradeComponent: { termId: ctx.termId } },
        OR: learnerOr,
      },
      select: {
        studentId: true,
        rosterId: true,
        percentageScore: true,
        assessment: { select: { gradeComponent: { select: { subjectId: true } } } },
      },
    }),
    // Status-only marks, full term — the advisory board's own inputs (no
    // subjectId: that flag means "subject marks exist" and switches the
    // denominator, which the board does not do).
    prisma.attendanceRecord.findMany({
      where: {
        termId: ctx.termId,
        OR: learnerOr,
      },
      select: { studentId: true, rosterId: true, status: true },
    }),
    prisma.anecdotalRecord.findMany({
      where: { termId: ctx.termId, deletedAt: null, OR: learnerOr },
      select: { studentId: true, rosterId: true },
    }),
    sectionAttendanceTotals(scope.sectionIds, ctx.termId),
    subjectAverageAttendance(scope.sectionIds, ctx.termId),
    admExemptStudentIds(ctx.termId),
  ]);

  const keyOf = (
    studentId: string | null,
    rosterId: string | null,
  ): string | null => studentId ?? (rosterId ? `roster:${rosterId}` : null);

  const finalsByKey = new Map<
    string,
    { computedAverage: number | null; transmutedGrade: number | null }[]
  >();
  for (const f of finalGrades) {
    const key = keyOf(f.studentId, f.rosterId);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }

  const rawBySubject = new Map<string, Map<string, { sum: number; count: number }>>();
  for (const row of rawRows) {
    const key = keyOf(row.studentId, row.rosterId);
    if (!key) continue;
    const subjectId = row.assessment.gradeComponent.subjectId;
    if (!rawBySubject.has(key)) rawBySubject.set(key, new Map());
    const perSubject = rawBySubject.get(key)!;
    const cell = perSubject.get(subjectId) ?? { sum: 0, count: 0 };
    cell.sum += row.percentageScore;
    cell.count += 1;
    perSubject.set(subjectId, cell);
  }

  const marksByKey = new Map<string, { status: string }[]>();
  for (const r of attendanceMarks) {
    const key = keyOf(r.studentId, r.rosterId);
    if (!key) continue;
    const arr = marksByKey.get(key) ?? [];
    arr.push({ status: r.status });
    marksByKey.set(key, arr);
  }

  const anecdoteCountByKey = new Map<string, number>();
  for (const a of anecdotalRows) {
    const key = keyOf(a.studentId, a.rosterId);
    if (!key) continue;
    anecdoteCountByKey.set(key, (anecdoteCountByKey.get(key) ?? 0) + 1);
  }

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

  // Current level per learner = the live derivation the advisory board uses
  // (never the persisted `riskLevel`, which only refreshes when the hourly
  // engine sees a flag flip and therefore drifts from the board).
  const started = termHasStarted(term?.startDate);
  const currentLevelByLearner = new Map<string, string>();
  const riskMix = { high: 0, moderate: 0, low: 0, unassessed: 0 };
  const learnerKeys = [
    ...profileIds,
    ...rosterIds.map((id) => `roster:${id}`),
  ];
  for (const key of learnerKeys) {
    let level: string = "Low";
    if (started) {
      const flags = computeRiskFactors({
        finalGrades: finalsByKey.get(key) ?? [],
        rawAverages: Array.from(
          (rawBySubject.get(key) ?? new Map()).values(),
        ).map((cell) => cell.sum / cell.count),
        attendance: marksByKey.get(key) ?? [],
        attendanceTotal: attendanceTotalFor(
          sectionTotals,
          sectionIdOf.get(key),
          key.startsWith("roster:") ? key.slice("roster:".length) : null,
        ),
        anecdotalCount: anecdoteCountByKey.get(key) ?? 0,
        enrolled: enrolledBySection.get(sectionIdOf.get(key) ?? "") ?? 0,
        attendanceExempt: admExempt.has(key),
      });
      // Subject-level attendance override, same gate as the advisory board.
      const subjAvg = subjectAvgs.get(key);
      if (subjAvg?.hasSubjectData) {
        flags.attendanceFlag = subjAvg.average < ATTENDANCE_RISK_CUTOFF;
      }
      level = levelFromFlags(flags);
    }
    currentLevelByLearner.set(key, level);
    if (level === "High") riskMix.high += 1;
    else if (level === "Moderate") riskMix.moderate += 1;
    else riskMix.low += 1;
  }
  riskMix.unassessed = Math.max(0, learnerCount - currentLevelByLearner.size);

  const snapshotsByLearner = new Map<string, { date: string; level: string }[]>();
  for (const [key, snap] of latestSnapshot) {
    const learner = key.slice(0, key.indexOf("|"));
    const date = key.slice(key.indexOf("|") + 1);
    const list = snapshotsByLearner.get(learner) ?? [];
    list.push({ date, level: snap.level });
    snapshotsByLearner.set(learner, list);
  }
  for (const list of snapshotsByLearner.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Level known on a given day: last snapshot on/before it, else the persisted level. */
  const levelOn = (learner: string, date: string): string | null => {
    const list = snapshotsByLearner.get(learner);
    if (list) {
      let level: string | null = null;
      for (const s of list) {
        if (s.date > date) break;
        level = s.level;
      }
      if (level) return level;
    }
    return currentLevelByLearner.get(learner) ?? null;
  };

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
    const levels = { high: 0, moderate: 0, low: 0 };
    for (const learner of currentLevelByLearner.keys()) {
      const level = levelOn(learner, date);
      if (!level) continue;
      if (level === "High") levels.high += 1;
      else if (level === "Moderate") levels.moderate += 1;
      else levels.low += 1;
    }
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
