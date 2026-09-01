import { prisma } from "../../lib/prisma.js";
import type { RiskLevel, OutcomeStatus } from "../../generated/prisma/client.js";
import { resolveActiveTermId, type GradeMode } from "../../services/risk.js";

export interface RiskBoardResult {
  kpis: {
    totalAtRiskFlags: number;
    highRiskStudents: number;
  };
  levelDistribution: { level: RiskLevel; count: number }[];
  factorTotals: { Academic: number; Attendance: number; Behavioral: number };
  interventionOutcome: {
    ongoing: number;
    resolved: number;
    unresolved: number;
  };
  trend: {
    term: string;
    high: number;
    moderate: number;
    low: number;
  }[];
}

// PLAN.md §6.3 — principal board overview (O4). Aggregates the active school
// year's student risk state plus per-term snapshots for the trend line.
// `gradeMode` selects whether the academic factor uses final (transmuted) or
// raw computed averages.
export async function getRiskBoard(
  gradeMode: GradeMode = "final"
): Promise<RiskBoardResult> {
  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = activeYear?.id;

  const terms: {
    id: string;
    termNumber: number;
    schoolYear: { name: string };
  }[] = schoolYearId
    ? await prisma.term.findMany({
        where: { schoolYearId },
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true, schoolYear: { select: { name: true } } },
      })
    : [];

  // Live risk recompute uses the single active-term resolver (same source of
  // truth as the heatmap/students endpoints) so the board never drifts.
  const activeTermId = await resolveActiveTermId();

  const Students = await prisma.studentProfile.findMany({
    where: schoolYearId ? { section: { schoolYearId } } : undefined,
    select: {
      finalGrades: {
        where: { termId: activeTermId ?? undefined },
        select: { computedAverage: true, transmutedGrade: true },
      },
      attendanceRecords: { where: { termId: activeTermId ?? undefined }, select: { status: true } },
      anecdotalRecords: { where: { termId: activeTermId ?? undefined }, select: { id: true } },
    },
  });

  const gradeOf = (g: { computedAverage: number | null; transmutedGrade: number | null }) =>
    gradeMode === "raw" ? g.computedAverage : g.transmutedGrade;

  // Level distribution + factor totals are both derived live from the same
  // factor logic (>=2 = High, 1 = Moderate, 0 = Low) so the board and the
  // students list share one source of truth and never trust stale stored
  // riskLevel columns.
  let academic = 0;
  let attendance = 0;
  let behavioral = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  for (const s of Students) {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (gradeOf(g) ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const aFlag = avg < 75;
    if (aFlag) academic++;

    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const total = s.attendanceRecords.length;
    const tFlag = total > 0 && present / total < 0.8;
    if (tFlag) attendance++;

    const bFlag = s.anecdotalRecords.length > 0;
    if (bFlag) behavioral++;

    const count = (aFlag ? 1 : 0) + (tFlag ? 1 : 0) + (bFlag ? 1 : 0);
    if (count >= 2) high++;
    else if (count === 1) moderate++;
    else low++;
  }

  // Total at-risk flags = sum of triggered factors across all students.
  const totalAtRiskFlags = academic + attendance + behavioral;

  const trend = await Promise.all(
    terms.map(async (t) => {
      const snaps = await prisma.riskSnapshot.groupBy({
        by: ["riskLevel"],
        where: { termId: t.id },
        _count: { _all: true },
      });
      const snapMap = new Map<RiskLevel, number>();
      for (const s of snaps) snapMap.set(s.riskLevel, s._count._all);
      return {
        term: `${t.schoolYear.name.split(" ")[0]} T${t.termNumber}`,
        high: snapMap.get("High") ?? 0,
        moderate: snapMap.get("Moderate") ?? 0,
        low: snapMap.get("Low") ?? 0,
      };
    })
  );

  const interventionGroups = await prisma.intervention.groupBy({
    by: ["outcomeStatus"],
    where: schoolYearId
      ? { student: { section: { schoolYearId } } }
      : undefined,
    _count: { _all: true },
  });
  const outcomeMap = new Map<OutcomeStatus, number>();
  for (const g of interventionGroups) outcomeMap.set(g.outcomeStatus, g._count._all);
  const interventionOutcome = {
    ongoing: outcomeMap.get("ongoing") ?? 0,
    resolved: outcomeMap.get("resolved") ?? 0,
    unresolved: outcomeMap.get("unresolved") ?? 0,
  };

  return {
    kpis: {
      totalAtRiskFlags,
      highRiskStudents: high,
    },
    levelDistribution: [
      { level: "High", count: high },
      { level: "Moderate", count: moderate },
      { level: "Low", count: low },
    ],
    factorTotals: {
      Academic: academic,
      Attendance: attendance,
      Behavioral: behavioral,
    },
    interventionOutcome,
    trend: trend.length > 0 ? trend : [{ term: "No terms", high: 0, moderate: 0, low: 0 }],
  };
}

export interface RiskTrendResult {
  schoolYearId: string | null;
  termId: string | null;
  trend: { date: string; term: string; high: number; moderate: number; low: number }[];
}

// School-year/term-scoped risk trend for the Risk Trend chart. When no
// schoolYearId is given it defaults to the active year. When a specific term
// is selected the trend is day-by-day (snapshots grouped by date within that
// term); otherwise it's one point per term across the school year.
export async function getRiskTrend(
  schoolYearId?: string,
  termId?: string
): Promise<RiskTrendResult> {
  const year = schoolYearId
    ? await prisma.schoolYear.findUnique({
        where: { id: schoolYearId },
        select: { id: true },
      })
    : await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
  const yearId = year?.id ?? null;

  if (termId && yearId) {
    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, schoolYearId: true, startDate: true, endDate: true },
    });
    const validTerm = term && term.schoolYearId === yearId ? term : null;

    if (validTerm) {
      const snaps = await prisma.riskSnapshot.findMany({
        where: { termId: validTerm.id },
        select: { snapshotDate: true, riskLevel: true },
      });

      if (snaps.length === 0) {
        return { schoolYearId: yearId, termId: validTerm.id, trend: [] };
      }

      const dayMap = new Map<string, { high: number; moderate: number; low: number }>();
      for (const s of snaps) {
        const key = s.snapshotDate.toISOString().slice(0, 10);
        const e = dayMap.get(key) ?? { high: 0, moderate: 0, low: 0 };
        if (s.riskLevel === "High") e.high++;
        else if (s.riskLevel === "Moderate") e.moderate++;
        else e.low++;
        dayMap.set(key, e);
      }

      const nowMs = Date.now();

      let start: Date;
      let end: Date;
      if (validTerm.startDate && validTerm.endDate) {
        start = new Date(validTerm.startDate);
        end = new Date(validTerm.endDate);
      } else {
        const keys = Array.from(dayMap.keys()).sort();
        start = new Date(`${keys[0]}T00:00:00`);
        end = new Date(`${keys[keys.length - 1]}T00:00:00`);
      }

      // A term's schedule can extend into the future; the daily series must
      // stop at "today" so we never emit zero-filled future days (which made
      // the trailing "Last 7 days" bucket land on empty days).
      if (end.getTime() > nowMs) end = new Date(nowMs);

      const trend: {
        date: string;
        term: string;
        high: number;
        moderate: number;
        low: number;
      }[] = [];
      const cur = new Date(start);
      const endMs = end.getTime();
      while (cur.getTime() <= endMs) {
        const key = cur.toISOString().slice(0, 10);
        const e = dayMap.get(key) ?? { high: 0, moderate: 0, low: 0 };
        trend.push({
          date: key,
          term: `${cur.getMonth() + 1}/${cur.getDate()}`,
          high: e.high,
          moderate: e.moderate,
          low: e.low,
        });
        cur.setDate(cur.getDate() + 1);
      }

      return { schoolYearId: yearId, termId: validTerm.id, trend };
    }
  }

  let terms = yearId
    ? await prisma.term.findMany({
        where: { schoolYearId: yearId },
        orderBy: { termNumber: "asc" },
        select: {
          id: true,
          termNumber: true,
          schoolYear: { select: { name: true } },
        },
      })
    : [];

  const trend = await Promise.all(
    terms.map(async (t) => {
      const snaps = await prisma.riskSnapshot.groupBy({
        by: ["riskLevel"],
        where: { termId: t.id },
        _count: { _all: true },
      });
      const map = new Map<RiskLevel, number>();
      for (const s of snaps) map.set(s.riskLevel, s._count._all);
      return {
        date: "",
        term: `${t.schoolYear.name.split(" ")[0]} T${t.termNumber}`,
        high: map.get("High") ?? 0,
        moderate: map.get("Moderate") ?? 0,
        low: map.get("Low") ?? 0,
      };
    })
  );

  return {
    schoolYearId: yearId,
    termId: null,
    trend:
      trend.length > 0
        ? trend
        : [{ date: "", term: "No terms", high: 0, moderate: 0, low: 0 }],
  };
}

// List of school years (with their terms) for the Risk Trend filters.
export async function getSchoolsForRisk() {
  const now = Date.now();
  const years = await prisma.schoolYear.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
      terms: {
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true },
      },
    },
  });
  // isCurrent = the school year whose span contains the current date, so the
  // Risk Trend front-end defaults to the year matching today regardless of the
  // isActive flag.
  return years.map((y) => ({
    id: y.id,
    name: y.name,
    isActive: y.isActive,
    isCurrent:
      new Date(y.startDate).getTime() <= now && now <= new Date(y.endDate).getTime(),
    startDate: y.startDate,
    endDate: y.endDate,
    terms: y.terms,
  }));
}
