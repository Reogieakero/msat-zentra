import { prisma } from "../../lib/prisma.js";
import type { RiskLevel, OutcomeStatus } from "@prisma/client";

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
export async function getRiskBoard(): Promise<RiskBoardResult> {
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

  const [profiles, riskCounts] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["riskLevel"],
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      _count: { _all: true },
    }),
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      select: { riskCount: true },
    }),
  ]);

  const levelMap = new Map<RiskLevel, number>();
  for (const p of profiles) levelMap.set(p.riskLevel, p._count._all);

  const high = levelMap.get("High") ?? 0;
  const moderate = levelMap.get("Moderate") ?? 0;
  const low = levelMap.get("Low") ?? 0;

  // Total at-risk flags = sum of every student's triggered risk factors (0..3).
  // Equals the sum of the three factor totals below.
  const totalAtRiskFlags = riskCounts.reduce((sum, r) => sum + (r.riskCount ?? 0), 0);

  // Factor totals: a student at riskCount N has triggered the first N factors
  // (Academic >=1, Attendance >=2, Behavioral =3).
  let academic = 0;
  let attendance = 0;
  let behavioral = 0;
  for (const r of riskCounts) {
    const c = r.riskCount ?? 0;
    if (c >= 1) academic++;
    if (c >= 2) attendance++;
    if (c >= 3) behavioral++;
  }

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
