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
  bySection: {
    section: string;
    gradeLevel: string;
    High: number;
    Moderate: number;
    Low: number;
    total: number;
  }[];
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
  admOnly = false,
): Promise<RiskBoardResult> {
  const schoolYearId =
    scope?.schoolYearId ??
    (
      await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      })
    )?.id;

  const activeTermId = scope?.termId ?? (await resolveActiveTermId());

  // The principal's ADM desk scopes the board to learners who actually have an
  // ADM case (any stage — endorsed to the principal or still with the
  // coordinator), never the general school-wide risk population. The ADM
  // dashboard the desk renders above this board counts cases school-wide
  // (every term), so the learner set here must not be term-filtered either —
  // otherwise a term with no new cases shows an empty risk board even though
  // the desk lists active cases filed in another term.
  let admStudentIds: Set<string> | null = null;
  if (admOnly) {
    const admProfiles = await prisma.admLearnerProfile.findMany({
      select: { studentId: true },
    });
    admStudentIds = new Set(admProfiles.map((p) => p.studentId));
  }

  let academic = 0;
  let attendance = 0;
  let behavioral = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  const byGradeMap = new Map<string, { High: number; Moderate: number; Low: number }>();
  const bySectionMap = new Map<string, { High: number; Moderate: number; Low: number }>();
  const sectionNameById = new Map<string, string>();
  const sectionGradeById = new Map<string, string>();
  const addGrade = (grade: string, level: string, n: number) => {
    const e = byGradeMap.get(grade) ?? { High: 0, Moderate: 0, Low: 0 };
    if (level === "High") e.High += n;
    else if (level === "Moderate") e.Moderate += n;
    else e.Low += n;
    byGradeMap.set(grade, e);
  };
  const addSection = (sectionId: string, level: string, n: number) => {
    const e = bySectionMap.get(sectionId) ?? { High: 0, Moderate: 0, Low: 0 };
    if (level === "High") e.High += n;
    else if (level === "Moderate") e.Moderate += n;
    else e.Low += n;
    bySectionMap.set(sectionId, e);
  };

  {
    // Real-time unified live computation (EITHER avg < 75). The ADM desk uses
    // an explicit learner set, so annual section scoping is redundant there.
    const yearProfile: any = admOnly
      ? {}
      : schoolYearId
        ? { student: { section: { schoolYearId } } }
        : {};
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
        where: admOnly
          ? admStudentIds
            ? { userId: { in: [...admStudentIds] } }
            : { userId: { in: [] } }
          : {
              ...(schoolYearId ? { section: { schoolYearId } } : {}),
              ...(admStudentIds ? { userId: { in: [...admStudentIds] } } : {}),
            },
        select: { userId: true, lrn: true, gradeLevel: true, sectionId: true },
      }),
      admOnly
        ? Promise.resolve([])
        : prisma.studentRoster.findMany({
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
    const sectionMeta = sectionIds.length
      ? await prisma.section.findMany({
          where: { id: { in: sectionIds } },
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            adviser: {
              select: { staffProfile: { select: { shareStudentData: true } } },
            },
          },
        })
      : [];
    const connectedSectionIds = new Set<string>();
    for (const s of sectionMeta) {
      sectionNameById.set(s.id, s.name);
      sectionGradeById.set(s.id, gradeLabel(s.gradeLevel));
      if (s.adviser?.staffProfile?.shareStudentData) connectedSectionIds.add(s.id);
    }
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
      // Adviser data gate: a learner only reaches the board when their class
      // adviser has claimed the section and switched student-data sharing ON.
      // The principal's ADM desk is exempt — an ADM case is already visible to
      // the principal in full, so gating its risk signals on the adviser's
      // sharing switch would blank the desk for every unshared section.
      const sectionId = sectionByKey.get(key);
      if (!admOnly && (!sectionId || !connectedSectionIds.has(sectionId))) continue;
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
      if (sectionId) addSection(sectionId, level, 1);
    }
  }

  const totalAtRiskFlags = academic + attendance + behavioral;

  // Weekly progression inside the selected term: one bar group per week of
  // the term. Each learner counts once per week — their latest snapshot in
  // that week — so repeating hourly sweeps don't inflate the bars.
  const trend: RiskBoardResult["trend"] = [];
  if (activeTermId) {
    const [termRow, snapshots] = await Promise.all([
      prisma.term.findUnique({
        where: { id: activeTermId },
        select: { startDate: true, endDate: true },
      }),
      prisma.riskSnapshot.findMany({
        where: {
          termId: activeTermId,
          ...(admStudentIds ? { studentId: { in: [...admStudentIds] } } : {}),
        },
        select: {
          snapshotDate: true,
          riskLevel: true,
          studentId: true,
          rosterId: true,
        },
        orderBy: { snapshotDate: "asc" },
      }),
    ]);

    if (snapshots.length > 0) {
      const WEEK_MS = 7 * 86_400_000;
      const nowMs = Date.now();
      const firstMs = snapshots[0].snapshotDate.getTime();
      const startMs = Math.min(termRow?.startDate?.getTime() ?? firstMs, firstMs);
      const endMs = Math.max(
        firstMs,
        Math.min(termRow?.endDate?.getTime() ?? nowMs, nowMs),
      );
      const bucketCount = Math.max(1, Math.ceil((endMs - startMs) / WEEK_MS));
      const buckets: Map<string, RiskLevel>[] = Array.from(
        { length: bucketCount },
        () => new Map<string, RiskLevel>(),
      );

      for (const snap of snapshots) {
        const idx = Math.floor((snap.snapshotDate.getTime() - startMs) / WEEK_MS);
        if (idx < 0 || idx >= bucketCount) continue;
        const key = snap.studentId ?? (snap.rosterId ? `roster:${snap.rosterId}` : null);
        if (!key) continue;
        buckets[idx].set(key, snap.riskLevel);
      }

      for (let i = 0; i < bucketCount; i++) {
        const bucketStart = new Date(startMs + i * WEEK_MS);
        const month = String(bucketStart.getMonth() + 1).padStart(2, "0");
        const day = String(bucketStart.getDate()).padStart(2, "0");
        let highCount = 0;
        let moderateCount = 0;
        let lowCount = 0;
        for (const level of buckets[i].values()) {
          if (level === "High") highCount++;
          else if (level === "Moderate") moderateCount++;
          else lowCount++;
        }
        trend.push({
          term: `${month}/${day}`,
          high: highCount,
          moderate: moderateCount,
          low: lowCount,
        });
      }
    }
  }
  // A trimester is ~13–14 weeks; cap the chart so long holiday gaps don't
  // squeeze the bars into unreadable slivers.
  let visibleTrend = trend.slice(-14);

  // The engine writes RiskSnapshot rows on its hourly sweep; before its first
  // run in a term there is no time series. Fall back to the live computed
  // levels so the ADM desk still shows its learners instead of an empty board.
  if (visibleTrend.length === 0 && high + moderate + low > 0) {
    visibleTrend = [{ term: "Now", high, moderate, low }];
  }

  const interventionGroups = await prisma.intervention.groupBy({
    by: ["outcomeStatus"],
    where: {
      ...(schoolYearId ? { student: { section: { schoolYearId } } } : {}),
      ...(admStudentIds ? { studentId: { in: [...admStudentIds] } } : {}),
    },
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

  const bySection = [...bySectionMap.entries()]
    .map(([sectionId, v]) => ({
      section: sectionNameById.get(sectionId) ?? sectionId,
      gradeLevel: sectionGradeById.get(sectionId) ?? "",
      ...v,
      total: v.High + v.Moderate + v.Low,
    }))
    .sort((a, b) => {
      const gradeDiff =
        Number(a.gradeLevel.replace(/\D/g, "")) - Number(b.gradeLevel.replace(/\D/g, ""));
      if (gradeDiff !== 0) return gradeDiff;
      return a.section.localeCompare(b.section, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

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
    bySection,
    factorTotals: {
      Academic: academic,
      Attendance: attendance,
      Behavioral: behavioral,
    },
    interventionOutcome,
    trend: visibleTrend,
  };
}

export interface RiskTrendResult {
  schoolYearId: string | null;
  termId: string | null;
  trend: { date: string; term: string; high: number; moderate: number; low: number }[];
}

/**
 * Learners the principal may see: only those in sections whose adviser has
 * claimed the section and switched student-data sharing ON.
 */
async function connectedLearnerIds(yearId: string): Promise<{
  studentIds: string[];
  rosterIds: string[];
}> {
  const sections = await prisma.section.findMany({
    where: {
      schoolYearId: yearId,
      adviser: { staffProfile: { shareStudentData: true } },
    },
    select: { id: true },
  });
  const sectionIds = sections.map((s) => s.id);
  if (sectionIds.length === 0) return { studentIds: [], rosterIds: [] };

  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { userId: true },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true },
    }),
  ]);

  return {
    studentIds: profiles.map((p) => p.userId),
    rosterIds: rosters.map((r) => r.id),
  };
}

function connectedOwnerFilter({
  studentIds,
  rosterIds,
}: {
  studentIds: string[];
  rosterIds: string[];
}) {
  return [
    ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
    ...(rosterIds.length > 0 ? [{ rosterId: { in: rosterIds } }] : []),
  ];
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
      const connected = await connectedLearnerIds(yearId);
      const ownerFilter = connectedOwnerFilter(connected);
      if (ownerFilter.length === 0) {
        return { schoolYearId: yearId, termId: validTerm.id, trend: [] };
      }

      const snaps = await prisma.riskSnapshot.findMany({
        where: { termId: validTerm.id, OR: ownerFilter },
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

  const connected = yearId
    ? await connectedLearnerIds(yearId)
    : { studentIds: [], rosterIds: [] };
  const ownerFilter = connectedOwnerFilter(connected);
  if (yearId && terms.length > 0 && ownerFilter.length === 0) {
    return { schoolYearId: yearId, termId: null, trend: [] };
  }

  const trend = await Promise.all(
    terms.map(async (t) => {
      const snaps = await prisma.riskSnapshot.groupBy({
        by: ["riskLevel"],
        where: { termId: t.id, OR: ownerFilter },
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
