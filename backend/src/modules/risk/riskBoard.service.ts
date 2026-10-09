import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { RiskLevel, OutcomeStatus } from "../../generated/prisma/client.js";
import {
  resolveActiveTermId,
  type GradeMode,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import { gradeLabel } from "../../lib/grades.js";
import type { TermScopeInput } from "../../lib/termScope.js";

export interface RiskBoardResult {
  kpis: {
    totalAtRiskFlags: number;
    highRiskStudents: number;
  };
  levelDistribution: { level: RiskLevel; count: number }[];
  byGrade: { grade: string; High: number; Moderate: number; Low: number; total: number }[];
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

// Real-time unified: gradeMode is ignored (kept for backwards compat).
export async function getRiskBoard(
  _gradeMode?: GradeMode,
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

  let academic = 0;
  let attendance = 0;
  let behavioral = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  const byGradeMap = new Map<string, { High: number; Moderate: number; Low: number }>();
  const addGrade = (grade: string, level: string, n: number) => {
    const e = byGradeMap.get(grade) ?? { High: 0, Moderate: 0, Low: 0 };
    if (level === "High") e.High += n;
    else if (level === "Moderate") e.Moderate += n;
    else e.Low += n;
    byGradeMap.set(grade, e);
  };

  {
    // Real-time unified live computation (EITHER avg < 75).
    const yearProfile: any = schoolYearId ? { student: { section: { schoolYearId } } } : {};
    const yearRoster: any = schoolYearId ? { roster: { schoolYearId } } : {};
    const termScope: any = activeTermId ? { termId: activeTermId } : {};
    const [
      gradeAvgsP,
      gradeAvgsR,
      subTotalP,
      subTotalR,
      subPresentP,
      subPresentR,
      allPresentP,
      allPresentR,
      anecdP,
      anecdR,
      profKeys,
      rosterKeys,
    ] = await Promise.all([
      prisma.finalGrade.groupBy({
        by: ["studentId"],
        where: { ...termScope, studentId: { not: null }, ...yearProfile },
        _avg: { computedAverage: true, transmutedGrade: true },
      }),
      prisma.finalGrade.groupBy({
        by: ["rosterId"],
        where: { ...termScope, rosterId: { not: null }, ...yearRoster },
        _avg: { computedAverage: true, transmutedGrade: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["studentId"],
        where: { ...termScope, studentId: { not: null }, subjectId: { not: null }, ...yearProfile },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["rosterId"],
        where: { ...termScope, rosterId: { not: null }, subjectId: { not: null }, ...yearRoster },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["studentId"],
        where: { ...termScope, studentId: { not: null }, subjectId: { not: null }, status: "present", ...yearProfile },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["rosterId"],
        where: { ...termScope, rosterId: { not: null }, subjectId: { not: null }, status: "present", ...yearRoster },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["studentId"],
        where: { ...termScope, studentId: { not: null }, status: "present", ...yearProfile },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["rosterId"],
        where: { ...termScope, rosterId: { not: null }, status: "present", ...yearRoster },
        _count: { _all: true },
      }),
      prisma.anecdotalRecord.groupBy({
        by: ["studentId"],
        where: { ...termScope, studentId: { not: null }, ...yearProfile },
        _count: { _all: true },
      }),
      prisma.anecdotalRecord.groupBy({
        by: ["rosterId"],
        where: { ...termScope, rosterId: { not: null }, ...yearRoster },
        _count: { _all: true },
      }),
      prisma.studentProfile.findMany({
        where: schoolYearId ? { section: { schoolYearId } } : undefined,
        select: { userId: true, lrn: true, gradeLevel: true, sectionId: true },
      }),
      prisma.studentRoster.findMany({
        where: schoolYearId ? { schoolYearId } : undefined,
        select: { id: true, lrn: true, gradeLevel: true, sectionId: true },
      }),
    ]);
    const countBy = (groups: any[], getKey: (g: any) => string | null) => {
      const m = new Map<string, number>();
      for (const g of groups) {
        const k = getKey(g);
        if (k) m.set(k, g._count._all);
      }
      return m;
    };
    const avgBy = (
      groups: any[],
      getKey: (g: any) => string | null,
      getAvg: (g: any) => number | null,
    ) => {
      const m = new Map<string, number>();
      for (const g of groups) {
        const k = getKey(g);
        const v = getAvg(g);
        if (k && v != null) m.set(k, v);
      }
      return m;
    };
    const registeredLrns = new Set(profKeys.map((s) => s.lrn));
    const sectionIds = Array.from(
      new Set(
        [...profKeys.map((s) => s.sectionId), ...rosterKeys.map((r) => r.sectionId)].filter(
          (id): id is string => !!id,
        ),
      ),
    );
    const headcounts = await sectionHeadcounts(sectionIds);
    const gradeByKey = new Map<string, string>();
    const sectionByKey = new Map<string, string>();
    for (const s of profKeys) {
      gradeByKey.set(s.userId, gradeLabel(s.gradeLevel));
      if (s.sectionId) sectionByKey.set(s.userId, s.sectionId);
    }
    for (const r of rosterKeys) {
      if (registeredLrns.has(r.lrn)) continue;
      gradeByKey.set(`roster:${r.id}`, gradeLabel(r.gradeLevel));
      if (r.sectionId) sectionByKey.set(`roster:${r.id}`, r.sectionId);
    }
    const rawAvgMap = new Map<string, number>([
      ...avgBy(gradeAvgsP, (g) => g.studentId, (g) => g._avg.computedAverage),
      ...avgBy(gradeAvgsR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null), (g) => g._avg.computedAverage),
    ]);
    const finalAvgMap = new Map<string, number>([
      ...avgBy(gradeAvgsP, (g) => g.studentId, (g) => g._avg.transmutedGrade),
      ...avgBy(gradeAvgsR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null), (g) => g._avg.transmutedGrade),
    ]);
    const subTotal = new Map<string, number>([
      ...countBy(subTotalP, (g) => g.studentId),
      ...countBy(subTotalR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null)),
    ]);
    const subPresent = new Map<string, number>([
      ...countBy(subPresentP, (g) => g.studentId),
      ...countBy(subPresentR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null)),
    ]);
    const allPresent = new Map<string, number>([
      ...countBy(allPresentP, (g) => g.studentId),
      ...countBy(allPresentR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null)),
    ]);
    const anecdCount = new Map<string, number>([
      ...countBy(anecdP, (g) => g.studentId),
      ...countBy(anecdR, (g) => (g.rosterId ? `roster:${g.rosterId}` : null)),
    ]);
    const rawKeys = new Set<string>([
      ...profKeys.map((s) => s.userId),
      ...rosterKeys.filter((r) => !registeredLrns.has(r.lrn)).map((r) => `roster:${r.id}`),
    ]);
    for (const key of rawKeys) {
      const rawAvg = rawAvgMap.get(key);
      const finalAvg = finalAvgMap.get(key);
      const academicFlag =
        (rawAvg != null && rawAvg < 75) || (finalAvg != null && finalAvg < 75);
      const subT = subTotal.get(key) ?? 0;
      let attendanceFlag: boolean;
      if (subT > 0) {
        attendanceFlag = (subPresent.get(key) ?? 0) / subT < 0.8;
      } else {
        const enrolled = headcounts.get(sectionByKey.get(key) ?? "") ?? 0;
        attendanceFlag = enrolled > 0 && (allPresent.get(key) ?? 0) / enrolled < 0.8;
      }
      const behavioralFlag = (anecdCount.get(key) ?? 0) >= 1;
      if (academicFlag) academic++;
      if (attendanceFlag) attendance++;
      if (behavioralFlag) behavioral++;

      const rawCount =
        (academicFlag ? 1 : 0) + (attendanceFlag ? 1 : 0) + (behavioralFlag ? 1 : 0);
      const level = rawCount >= 2 ? "High" : rawCount === 1 ? "Moderate" : "Low";
      if (level === "High") high++;
      else if (level === "Moderate") moderate++;
      else low++;
      addGrade(gradeByKey.get(key) ?? "—", level, 1);
    }
  }

  const totalAtRiskFlags = academic + attendance + behavioral;

  // Unified trend uses canonical riskLevel (snapshots now write unified value to all columns).
  const trendLevelColumn = "riskLevel";
  const trend = await Promise.all(
    terms.map(async (t) => {
      const snaps = await prisma.$queryRaw<{ riskLevel: string; count: bigint }[]>(
        Prisma.sql`SELECT latest."riskLevel", COUNT(*) AS count FROM (SELECT DISTINCT ON (COALESCE("studentId", 'roster:' || "rosterId")) COALESCE("studentId", 'roster:' || "rosterId") AS k, ${Prisma.raw(`"${trendLevelColumn}"`)} AS "riskLevel" FROM "RiskSnapshot" WHERE "termId" = ${t.id} AND ${Prisma.raw(`"${trendLevelColumn}"`)} IS NOT NULL ORDER BY COALESCE("studentId", 'roster:' || "rosterId"), "snapshotDate" DESC) AS latest GROUP BY latest."riskLevel"`,
      );
      const snapMap = new Map<string, number>();
      for (const s of snaps) snapMap.set(s.riskLevel, Number(s.count));
      return {
        term: `${t.schoolYear.name.split(" ")[0]} T${t.termNumber}`,
        high: snapMap.get("High") ?? 0,
        moderate: snapMap.get("Moderate") ?? 0,
        low: snapMap.get("Low") ?? 0,
      };
    }),
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

  const byGrade = [...byGradeMap.entries()]
    .map(([grade, v]) => ({ grade, ...v, total: v.High + v.Moderate + v.Low }))
    .sort((a, b) => Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, "")));

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
    byGrade,
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
