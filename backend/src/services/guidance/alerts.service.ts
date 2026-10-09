import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  ADM_LABEL,
  GRADE_LABELS,
  type AdmStage,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export interface AlertsQuery {
  level: "High" | "Moderate" | null;
  factor: "academic" | "attendance" | "behavioral" | null;
  q: string;
  page: number;
  pageSize: number;
}

const FLAG_COLUMN: Record<string, string> = {
  academic: "academicFlag",
  attendance: "attendanceFlag",
  behavioral: "behavioralFlag",
};

export async function getAlerts(ctx: GuidanceContext, query: AlertsQuery) {
  const { levelFilter, factorFilter, q, page, pageSize } = {
    levelFilter: query.level,
    factorFilter: query.factor,
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  };
  const schoolYearId = ctx.schoolYearId;
  const termId = ctx.termId;
  const term = termId
    ? await prisma.term.findUnique({
        where: { id: termId },
        select: { termNumber: true, schoolYear: { select: { name: true } } },
      })
    : null;
  const termLabel = term
    ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
    : "No active term";

  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const needle = q.trim();
  const atRiskLevels = levelFilter ? [levelFilter] : ["High", "Moderate"];

  const profileSearch: any = needle
    ? {
        OR: [
          { user: { fullName: { contains: needle, mode: "insensitive" } } },
          { lrn: { contains: needle, mode: "insensitive" } },
          { section: { name: { contains: needle, mode: "insensitive" } } },
        ],
      }
    : null;
  const profileScope: any = {
    AND: [
      ...(schoolYearId ? [{ section: { schoolYearId } }] : []),
      ...(profileSearch ? [profileSearch] : []),
    ],
  };
  const profileFilteredWhere: any = {
    AND: [
      profileScope,
      { riskLevel: { in: atRiskLevels } },
      ...(factorFilter ? [{ [FLAG_COLUMN[factorFilter]]: true }] : []),
    ],
  };

  const rosterConds = (filtered: boolean): Prisma.Sql[] => {
    const conds: Prisma.Sql[] = [
      Prisma.sql`r."riskLevel" IN (${levelFilter ? levelFilter : Prisma.raw("'High', 'Moderate'")})`,
    ];
    if (schoolYearId) conds.push(Prisma.sql`r."schoolYearId" = ${schoolYearId}`);
    if (filtered && factorFilter)
      conds.push(Prisma.sql`${Prisma.raw(`r."${FLAG_COLUMN[factorFilter]}"`)} = TRUE`);
    if (needle)
      conds.push(
        Prisma.sql`(r."fullName" ILIKE ${`%${needle}%`} OR r."lrn" ILIKE ${`%${needle}%`} OR s."name" ILIKE ${`%${needle}%`})`,
      );
    return conds;
  };
  const rosterDedup = Prisma.sql`NOT EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."lrn" = r."lrn")`;

  const [profileTotal, rosterTotalRows, profileGroups, rosterLevelRows, rosterFlagRows, profileFlagCounts] =
    await Promise.all([
      prisma.studentProfile.count({ where: profileFilteredWhere }),
      prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS count FROM "StudentRoster" r LEFT JOIN "Section" s ON s."id" = r."sectionId" WHERE ${Prisma.join(rosterConds(true), " AND ")} AND ${rosterDedup}`,
      ),
      prisma.studentProfile.groupBy({
        by: ["riskLevel"],
        where: { AND: [profileScope, { riskLevel: { in: ["High", "Moderate"] } }] },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ level: string; count: bigint }[]>(
        Prisma.sql`SELECT r."riskLevel" AS level, COUNT(*) AS count FROM "StudentRoster" r LEFT JOIN "Section" s ON s."id" = r."sectionId" WHERE ${Prisma.join(rosterConds(false), " AND ")} AND ${rosterDedup} GROUP BY r."riskLevel"`,
      ),
      prisma.$queryRaw<{ academic: bigint; attendance: bigint; behavioral: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) FILTER (WHERE r."academicFlag") AS academic, COUNT(*) FILTER (WHERE r."attendanceFlag") AS attendance, COUNT(*) FILTER (WHERE r."behavioralFlag") AS behavioral FROM "StudentRoster" r LEFT JOIN "Section" s ON s."id" = r."sectionId" WHERE ${Prisma.join(rosterConds(false), " AND ")} AND ${rosterDedup}`,
      ),
      Promise.all(
        ["academicFlag", "attendanceFlag", "behavioralFlag"].map((f) =>
          prisma.studentProfile.count({ where: { AND: [profileScope, { [f]: true }] } }),
        ),
      ),
    ]);

  const rosterTotal = Number(rosterTotalRows[0]?.count ?? 0);
  const total = profileTotal + rosterTotal;
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const windowTake = safePage * effPageSize;

  const [profileWindow, rosterWindow] = await Promise.all([
    prisma.studentProfile.findMany({
      where: profileFilteredWhere,
      select: {
        userId: true,
        lrn: true,
        gradeLevel: true,
        riskLevel: true,
        riskCount: true,
        academicFlag: true,
        attendanceFlag: true,
        behavioralFlag: true,
        user: { select: { fullName: true } },
        section: { select: { name: true } },
      },
      orderBy: [{ riskCount: "desc" }, { user: { fullName: "asc" } }],
      take: windowTake,
    }),
    prisma.$queryRaw<
      {
        id: string;
        lrn: string;
        fullName: string;
        gradeLevel: string;
        sectionName: string | null;
        riskLevel: string;
        riskCount: number;
        academicFlag: boolean;
        attendanceFlag: boolean;
        behavioralFlag: boolean;
      }[]
    >(
      Prisma.sql`SELECT r."id", r."lrn", r."fullName", r."gradeLevel", s."name" AS "sectionName", r."riskLevel", r."riskCount", r."academicFlag", r."attendanceFlag", r."behavioralFlag" FROM "StudentRoster" r LEFT JOIN "Section" s ON s."id" = r."sectionId" WHERE ${Prisma.join(rosterConds(true), " AND ")} AND ${rosterDedup} ORDER BY r."riskCount" DESC, r."fullName" ASC LIMIT ${windowTake} OFFSET 0`,
    ),
  ]);

  const mergedWindow = [
    ...profileWindow.map((p) => ({
      kind: "profile" as const,
      id: p.userId,
      student: p.user.fullName,
      lrn: p.lrn,
      section: p.section?.name ?? "—",
      grade: GRADE_LABELS[p.gradeLevel] ?? p.gradeLevel,
      level: p.riskLevel,
      riskCount: p.riskCount,
      academicFlag: p.academicFlag,
      attendanceFlag: p.attendanceFlag,
      behavioralFlag: p.behavioralFlag,
    })),
    ...rosterWindow.map((r) => ({
      kind: "roster" as const,
      id: `roster:${r.id}`,
      student: r.fullName,
      lrn: r.lrn,
      section: r.sectionName ?? "—",
      grade: GRADE_LABELS[r.gradeLevel as keyof typeof GRADE_LABELS] ?? r.gradeLevel,
      level: r.riskLevel,
      riskCount: r.riskCount,
      academicFlag: r.academicFlag,
      attendanceFlag: r.attendanceFlag,
      behavioralFlag: r.behavioralFlag,
    })),
  ]
    .sort((a, b) => b.riskCount - a.riskCount || a.student.localeCompare(b.student))
    .slice((safePage - 1) * effPageSize, safePage * effPageSize);

  const windowProfileIds = mergedWindow.filter((w) => w.kind === "profile").map((w) => w.id);
  const windowRosterIds = mergedWindow
    .filter((w) => w.kind === "roster")
    .map((w) => w.id.slice(7));
  const keyOr: any[] = [
    ...(windowProfileIds.length ? [{ studentId: { in: windowProfileIds } }] : []),
    ...(windowRosterIds.length ? [{ rosterId: { in: windowRosterIds } }] : []),
  ];

  const [anecdProfileGroups, anecdRosterGroups, guidanceReferrals, interventions, admProfiles, admReferrals] =
    await Promise.all([
      windowProfileIds.length
        ? prisma.anecdotalRecord.groupBy({
            by: ["studentId"],
            where: { ...(termId ? { termId } : {}), studentId: { in: windowProfileIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { studentId: string | null; _count: { _all: number } }[]),
      windowRosterIds.length
        ? prisma.anecdotalRecord.groupBy({
            by: ["rosterId"],
            where: { ...(termId ? { termId } : {}), rosterId: { in: windowRosterIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { rosterId: string | null; _count: { _all: number } }[]),
      keyOr.length
        ? prisma.referral.findMany({
            where: {
              referredToRole: "guidance_counselor",
              ...(termId ? { termId } : {}),
              OR: keyOr,
            },
            select: { studentId: true, rosterId: true, status: true },
          })
        : Promise.resolve([]),
      keyOr.length
        ? prisma.intervention.findMany({
            where: { ...(termId ? { termId } : {}), OR: keyOr },
            select: { studentId: true, rosterId: true, outcomeStatus: true },
          })
        : Promise.resolve([]),
      windowProfileIds.length
        ? prisma.admLearnerProfile.findMany({
            where: { ...(termId ? { termId } : {}), studentId: { in: windowProfileIds } },
            select: { studentId: true, stage: true },
          })
        : Promise.resolve([]),
      keyOr.length
        ? prisma.referral.findMany({
            where: {
              referredToRole: "adm_coordinator",
              ...(termId ? { termId } : {}),
              OR: keyOr,
            },
            select: { studentId: true, rosterId: true },
          })
        : Promise.resolve([]),
    ]);

  const anecdByKey = new Map<string, number>();
  for (const g of anecdProfileGroups) if (g.studentId) anecdByKey.set(g.studentId, g._count._all);
  for (const g of anecdRosterGroups) if (g.rosterId) anecdByKey.set(`roster:${g.rosterId}`, g._count._all);
  const referralByKey = new Map<string, string>();
  for (const r of guidanceReferrals) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (key && !referralByKey.has(key)) referralByKey.set(key, r.status);
  }
  const interventionByKey = new Map<string, string>();
  for (const iv of interventions) {
    const key = iv.studentId ?? (iv.rosterId ? `roster:${iv.rosterId}` : null);
    if (key && !interventionByKey.has(key)) interventionByKey.set(key, iv.outcomeStatus);
  }
  const admStageByKey = new Map<string, string>();
  for (const p of admProfiles) {
    if (!admStageByKey.has(p.studentId)) admStageByKey.set(p.studentId, p.stage);
  }
  for (const r of admReferrals) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (key && !admStageByKey.has(key)) admStageByKey.set(key, "consultation");
  }

  const alerts = mergedWindow.map((w) => {
    const anecdotalCount = anecdByKey.get(w.id) ?? 0;
    const flagCount =
      (w.academicFlag ? 1 : 0) + (w.attendanceFlag ? 1 : 0) + (w.behavioralFlag ? 1 : 0);
    const triggers: string[] = [];
    if (w.academicFlag) triggers.push("Academic average below 75");
    if (w.attendanceFlag) triggers.push("Attendance below 80%");
    if (w.behavioralFlag)
      triggers.push(`${anecdotalCount} behavioral report${anecdotalCount === 1 ? "" : "s"} filed`);
    const admStage = admStageByKey.get(w.id) ?? null;
    return {
      id: w.id,
      student: w.student,
      lrn: w.lrn,
      section: w.section,
      grade: w.grade,
      level: w.level,
      flagCount,
      factors: {
        academic: w.academicFlag,
        attendance: w.attendanceFlag,
        behavioral: w.behavioralFlag,
      },
      triggers,
      anecdotalCount,
      referralStatus: referralByKey.get(w.id) ?? null,
      interventionOutcome: interventionByKey.get(w.id) ?? null,
      track: admStage ? "adm" : "general",
      admStageLabel: admStage ? (ADM_LABEL.get(admStage as AdmStage) ?? admStage) : null,
    };
  });

  const levelCount = (groups: any[], level: string) =>
    groups.find((g) => g.riskLevel === level)?._count._all ?? 0;
  const rosterLevelCount = (level: string) =>
    Number(rosterLevelRows.find((r) => r.level === level)?.count ?? 0);
  const high = levelCount(profileGroups, "High") + rosterLevelCount("High");
  const moderate =
    levelCount(profileGroups, "Moderate") + rosterLevelCount("Moderate");

  return {
    termLabel,
    summary: {
      high,
      moderate,
      total: high + moderate,
      academic:
        profileFlagCounts[0] +
        Number(rosterFlagRows[0]?.academic ?? 0),
      attendance: profileFlagCounts[1] + Number(rosterFlagRows[0]?.attendance ?? 0),
      behavioral: profileFlagCounts[2] + Number(rosterFlagRows[0]?.behavioral ?? 0),
    },
    alerts,
    page: safePage,
    pageSize: effPageSize,
    total,
    totalPages,
    unfilteredTotal: high + moderate,
  };
}
