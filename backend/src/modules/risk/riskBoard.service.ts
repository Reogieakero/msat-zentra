import { prisma } from "../../lib/prisma.js";
import type { RiskLevel, OutcomeStatus } from "../../generated/prisma/client.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
  type GradeMode,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import type { TermScopeInput } from "../../lib/termScope.js";

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

export async function getRiskBoard(
  gradeMode: GradeMode = "final",
  scope?: TermScopeInput,
): Promise<RiskBoardResult> {
  const schoolYearId =
    scope?.schoolYearId ??
    (
      await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      })
    )?.id;

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

  const activeTermId = scope?.termId ?? (await resolveActiveTermId());

  const [profileStudents, rosterStudents] = await Promise.all([
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      select: {
        lrn: true,
        section: { select: { id: true } },
        finalGrades: {
          where: { termId: activeTermId ?? undefined },
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: { termId: activeTermId ?? undefined },

          select: { status: true, subjectId: true },
        },
        anecdotalRecords: { where: { termId: activeTermId ?? undefined }, select: { id: true } },
      },
    }),

    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      select: {
        lrn: true,
        sectionId: true,
        finalGrades: {
          where: { termId: activeTermId ?? undefined },
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: { termId: activeTermId ?? undefined },
          select: { status: true, subjectId: true },
        },
        anecdotalRecords: { where: { termId: activeTermId ?? undefined }, select: { id: true } },
      },
    }),
  ]);
  const registeredLrns = new Set(profileStudents.map((s) => s.lrn));

  const headcounts = await sectionHeadcounts(
    Array.from(
      new Set(
        [
          ...profileStudents.map((s) => s.section?.id),
          ...rosterStudents.map((r) => r.sectionId),
        ].filter((id): id is string => !!id),
      ),
    ),
  );

  let academic = 0;
  let attendance = 0;
  let behavioral = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  const candidates = [
    ...profileStudents.map((s) => ({
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
      enrolled: headcounts.get(s.section?.id ?? "") ?? 0,
    })),
    ...rosterStudents
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
        enrolled: headcounts.get(r.sectionId ?? "") ?? 0,
      })),
  ];
  for (const s of candidates) {
    const flags = computeRiskFactors({
      finalGrades: s.finalGrades,
      gradeMode,
      attendance: s.attendanceRecords,
      anecdotalCount: s.anecdotalCount,
      enrolled: s.enrolled,
    });
    if (flags.academicFlag) academic++;
    if (flags.attendanceFlag) attendance++;
    if (flags.behavioralFlag) behavioral++;

    const level = levelFromFlags(flags);
    if (level === "High") high++;
    else if (level === "Moderate") moderate++;
    else low++;
  }

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
