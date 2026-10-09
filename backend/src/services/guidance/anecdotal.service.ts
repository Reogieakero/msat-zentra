import { prisma } from "../../lib/prisma.js";
import {
  GRADE_LABELS,
  GRADE_ORDER,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export type AnecdotalCategory = "behavioral" | "bullying" | "academic" | "attendance" | "health";

export interface AnecdotalQuery {
  categoryFilter: AnecdotalCategory | null;
  q: string;
  anecdotalTypeFilter: "adm" | "counseling" | null;
  docsOnly: boolean;
  page: number;
  pageSize: number;
}

export async function getAnecdotal(ctx: GuidanceContext, query: AnecdotalQuery) {
  const { categoryFilter, q, anecdotalTypeFilter, docsOnly, page, pageSize } = query;

  const scopeTermId = ctx.termId;

  const anecdotalDbClauses: any[] = [];
  if (categoryFilter) {
    anecdotalDbClauses.push({ anecdotalRecord: { category: categoryFilter } });
  }
  if (anecdotalTypeFilter === "adm") {
    anecdotalDbClauses.push({
      OR: [
        { escalatedTo: "adm_coordinator" },
        { referredToRole: "adm_coordinator" },
      ],
    });
  } else if (anecdotalTypeFilter === "counseling") {
    anecdotalDbClauses.push({
      AND: [
        {
          OR: [
            { escalatedTo: null },
            { escalatedTo: { not: "adm_coordinator" } },
          ],
        },
        { referredToRole: { not: "adm_coordinator" } },
      ],
    });
  }

  const deskScope = {
    OR: [
      { referredToRole: "guidance_counselor" },
      {
        referredToRole: "adm_coordinator",
        OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
      },
    ],
  };
  const scopeClauses: any[] = [deskScope];
  if (scopeTermId) scopeClauses.push({ termId: scopeTermId });
  if (anecdotalDbClauses.length) scopeClauses.push(...anecdotalDbClauses);
  const summaryWhere: any = { AND: scopeClauses };

  const extraClauses: any[] = [];
  if (docsOnly) {
    extraClauses.push({
      counselingSessions: {
        some: { status: "completed", attachments: { some: { mimeType: { startsWith: "image/" } } } },
      },
    });
  }
  const needle = q.trim();
  if (needle) {
    extraClauses.push({
      OR: [
        { student: { user: { fullName: { contains: needle, mode: "insensitive" } } } },
        { student: { lrn: { contains: needle, mode: "insensitive" } } },
        { student: { section: { name: { contains: needle, mode: "insensitive" } } } },
        { roster: { fullName: { contains: needle, mode: "insensitive" } } },
        { roster: { lrn: { contains: needle, mode: "insensitive" } } },
        { roster: { section: { name: { contains: needle, mode: "insensitive" } } } },
        { referredByUser: { fullName: { contains: needle, mode: "insensitive" } } },
        { anecdotalRecord: { observer: { fullName: { contains: needle, mode: "insensitive" } } } },
      ],
    });
  }
  const pagedWhere: any = { AND: [...scopeClauses, ...extraClauses] };

  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const orderBy = [
    { anecdotalRecord: { observationDatetime: "desc" as const } },
    { id: "desc" as const },
  ];

  const [summaryTotal, total] = await Promise.all([
    prisma.referral.count({ where: summaryWhere }),
    prisma.referral.count({ where: pagedWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageIds = (
    await prisma.referral.findMany({
      where: pagedWhere,
      select: { id: true },
      orderBy,
      skip: (safePage - 1) * effPageSize,
      take: effPageSize,
    })
  ).map((r) => r.id);

  const pageRows = await prisma.referral.findMany({
    where: { id: { in: pageIds } },
    orderBy,
    select: {
      id: true,
      status: true,
      referredToRole: true,
      escalatedTo: true,
      referredByUser: { select: { fullName: true } },
      anecdotalRecord: {
        select: {
          id: true,
          category: true,
          observationDatetime: true,
          confidentialityLevel: true,
          observer: { select: { fullName: true } },
        },
      },
      student: {
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: {
          lrn: true,
          fullName: true,
          gradeLevel: true,
          section: { select: { name: true } },
        },
      },

      counselingSessions: {
        where: { status: "completed" },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          sessionType: true,
          scheduledAt: true,
          attachments: {
            orderBy: { uploadedAt: "asc" },
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              uploadedAt: true,
            },
          },
        },
      },
    },
  });

  const trackOf = (r: (typeof pageRows)[number]) =>
    r.escalatedTo === "adm_coordinator" || r.referredToRole === "adm_coordinator"
      ? "ADM"
      : "Counseling";
  const mapped = pageRows.map((r) => ({
    id: r.anecdotalRecord.id,
    referralId: r.id,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
    category: r.anecdotalRecord.category,
    observer: r.anecdotalRecord.observer?.fullName ?? "—",
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
    confidentiality: r.anecdotalRecord.confidentialityLevel,
    referralStatus: r.status,
    sessionDocs: r.counselingSessions
      .filter((s) => (s.attachments ?? []).length > 0)
      .map((s) => ({
        sessionId: s.id,
        sessionType: s.sessionType,
        date: s.scheduledAt.toISOString().slice(0, 10),
        files: (s.attachments ?? []).map((a) => ({
          id: a.id,
          fileUrl: a.fileUrl,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          uploadedAt: a.uploadedAt.toISOString(),
        })),
      })),

    referralType: trackOf(r),
  }));

  const records = mapped;

  const categories = ["behavioral", "bullying", "academic", "attendance", "health"];
  const catCounts = await Promise.all(
    categories.map((cat) =>
      prisma.referral.count({
        where: { AND: [summaryWhere, { anecdotalRecord: { category: cat } }] },
      }),
    ),
  );
  const gradeCounts = await Promise.all(
    GRADE_ORDER.map((g) =>
      prisma.referral.count({
        where: {
          AND: [
            summaryWhere,
            { OR: [{ student: { gradeLevel: g } }, { roster: { gradeLevel: g } }] },
          ],
        },
      }),
    ),
  );
  const byGrade = GRADE_ORDER.map((g, i) => ({
    grade: GRADE_LABELS[g] ?? g,
    count: gradeCounts[i] ?? 0,
  }));

  const [topProfileGroups, topRosterGroups] = await Promise.all([
    prisma.anecdotalRecord.groupBy({
      by: ["studentId"],
      where: { studentId: { not: null }, referrals: { some: summaryWhere } },
      _count: { _all: true },
      orderBy: { _count: { studentId: "desc" } },
      take: 5,
    }),
    prisma.anecdotalRecord.groupBy({
      by: ["rosterId"],
      where: { rosterId: { not: null }, referrals: { some: summaryWhere } },
      _count: { _all: true },
      orderBy: { _count: { rosterId: "desc" } },
      take: 5,
    }),
  ]);
  const topProfileIds = topProfileGroups.map((g) => g.studentId).filter((v): v is string => !!v);
  const topRosterIds = topRosterGroups.map((g) => g.rosterId).filter((v): v is string => !!v);
  const [topProfiles, topRosters] = await Promise.all([
    topProfileIds.length
      ? prisma.studentProfile.findMany({
          where: { userId: { in: topProfileIds } },
          select: { userId: true, lrn: true, user: { select: { fullName: true } }, section: { select: { name: true } } },
        })
      : Promise.resolve([]),
    topRosterIds.length
      ? prisma.studentRoster.findMany({
          where: { id: { in: topRosterIds } },
          select: { id: true, lrn: true, fullName: true, section: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);
  const topCountById = new Map<string, number>();
  for (const g of topProfileGroups) if (g.studentId) topCountById.set(g.studentId, g._count._all);
  for (const g of topRosterGroups) if (g.rosterId) topCountById.set(`roster:${g.rosterId}`, g._count._all);
  const topCandidates = [
    ...topProfiles.map((p) => ({
      student: p.user.fullName,
      lrn: p.lrn,
      section: p.section?.name ?? "—",
      count: topCountById.get(p.userId) ?? 0,
    })),
    ...topRosters.map((r) => ({
      student: r.fullName,
      lrn: r.lrn,
      section: r.section?.name ?? "—",
      count: topCountById.get(`roster:${r.id}`) ?? 0,
    })),
  ];
  const mergedTops = new Map<string, { student: string; lrn: string; section: string; count: number }>();
  for (const c of topCandidates) {
    const key = c.lrn || c.student;
    const prev = mergedTops.get(key);
    if (prev) prev.count += c.count;
    else mergedTops.set(key, { ...c });
  }
  const topStudents = [...mergedTops.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  return {
    summary: {
      total: summaryTotal,
      behavioral: catCounts[0] ?? 0,
      bullying: catCounts[1] ?? 0,
      academic: catCounts[2] ?? 0,
      attendance: catCounts[3] ?? 0,
      health: catCounts[4] ?? 0,
      byGrade,
      topStudents,
    },
    records,
    page: safePage,
    pageSize: effPageSize,
    total,
    totalPages,
    unfilteredTotal: summaryTotal,
  };
}
