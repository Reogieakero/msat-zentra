import { prisma } from "../../lib/prisma.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import { GRADE_LABELS } from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export type ReferralStatusFilter =
  | "pending"
  | "in_progress"
  | "resolved"
  | "escalated"
  | "follow_up"
  | "info_requested"
  | "dismissed";

export interface CasesQuery {
  statusFilter: ReferralStatusFilter | null;
  q: string;
  typeFilter: "adm" | "counseling" | null;
  bookedFilter: boolean;
  completedFilter: boolean;
  openFilter: boolean;
  page: number;
  pageSize: number;
  highlight: string;
}

export async function getCases(ctx: GuidanceContext, query: CasesQuery) {
  const {
    statusFilter,
    q,
    typeFilter,
    bookedFilter,
    completedFilter,
    openFilter,
    page,
    pageSize,
    highlight,
  } = query;

  const scopeTermId = ctx.termId;

  const dbClauses: any[] = [];
  if (statusFilter) dbClauses.push({ status: statusFilter });
  if (typeFilter === "adm") {
    dbClauses.push({
      OR: [
        { escalatedTo: "adm_coordinator" },
        { referredToRole: "adm_coordinator" },
      ],
    });
  } else if (typeFilter === "counseling") {

    dbClauses.push({
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
  if (dbClauses.length) scopeClauses.push(...dbClauses);
  const baseWhere: any = { AND: scopeClauses };

  const sessionClauses: any[] = [];
  if (bookedFilter) sessionClauses.push({ counselingSessions: { some: {} } });
  if (completedFilter) sessionClauses.push({ counselingSessions: { some: { status: "completed" } } });
  if (openFilter) sessionClauses.push({ status: { notIn: ["resolved", "dismissed"] } });

  const needle = q.trim();
  const searchClause = needle
    ? {
        OR: [
          { reason: { contains: needle, mode: "insensitive" } },
          { student: { user: { fullName: { contains: needle, mode: "insensitive" } } } },
          { student: { lrn: { contains: needle, mode: "insensitive" } } },
          { student: { section: { name: { contains: needle, mode: "insensitive" } } } },
          { roster: { fullName: { contains: needle, mode: "insensitive" } } },
          { roster: { lrn: { contains: needle, mode: "insensitive" } } },
          { roster: { section: { name: { contains: needle, mode: "insensitive" } } } },
          { referredByUser: { fullName: { contains: needle, mode: "insensitive" } } },
          { anecdotalRecord: { descriptionOfIncident: { contains: needle, mode: "insensitive" } } },
          { anecdotalRecord: { observer: { fullName: { contains: needle, mode: "insensitive" } } } },
        ],
      }
    : null;
  const pagedWhere: any = {
    AND: [...scopeClauses, ...sessionClauses, ...(searchClause ? [searchClause] : [])],
  };

  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const orderBy = [
    { anecdotalRecord: { observationDatetime: "desc" as const } },
    { id: "desc" as const },
  ];

  const [unfilteredTotal, total] = await Promise.all([
    prisma.referral.count({ where: baseWhere }),
    prisma.referral.count({ where: pagedWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  let safePage = Math.min(Math.max(1, page), totalPages);
  if (highlight) {
    const hl = await prisma.referral.findFirst({
      where: { ...pagedWhere, id: highlight },
      select: { id: true, anecdotalRecord: { select: { observationDatetime: true } } },
    });
    const hlDt = hl?.anecdotalRecord?.observationDatetime;
    if (hl && hlDt) {
      const rank = await prisma.referral.count({
        where: {
          AND: [
            pagedWhere,
            {
              OR: [
                { anecdotalRecord: { observationDatetime: { gt: hlDt } } },
                { anecdotalRecord: { observationDatetime: hlDt }, id: { gt: highlight } },
              ],
            },
          ],
        },
      });
      safePage = Math.floor(rank / effPageSize) + 1;
    }
  }
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
      reason: true,
      status: true,
      referredToRole: true,
      notes: true,
      escalationReason: true,
      escalatedTo: true,
      followUpDate: true,
      priority: true,
      intakeNotes: true,
      acceptedAt: true,
      resolutionSummary: true,
      resolvedAt: true,
      referredByUser: { select: { fullName: true } },
      counselingSessions: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          sessionType: true,
          scheduledAt: true,
          venue: true,
          status: true,
          sessionNotes: true,
          outcome: true,
          cancelReason: true,
          createdAt: true,
          completedAt: true,
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
      anecdotalRecord: {
        select: {
          id: true,
          category: true,
          observationDatetime: true,
          descriptionOfIncident: true,
          descriptionOfLocation: true,
          notesRecommendationsActions: true,
          confidentialityLevel: true,
          observer: { select: { fullName: true } },
        },
      },
      student: {
        select: {
          lrn: true,
          gradeLevel: true,
          userId: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          gradeLevel: true,
          section: { select: { name: true } },
        },
      },
    },
  });

  const mapped = pageRows.map((r) => ({
    id: r.id,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",

    studentId: r.student?.userId ?? r.roster?.id ?? null,

    type:
      r.escalatedTo === "adm_coordinator" || r.referredToRole === "adm_coordinator"
        ? "ADM"
        : "Counseling",
    category: r.anecdotalRecord.category,
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    observer: r.anecdotalRecord.observer?.fullName ?? "—",
    reason: r.reason,
    status: r.status,
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
    anecdotalId: r.anecdotalRecord.id,
    anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
    location: r.anecdotalRecord.descriptionOfLocation ?? "",
    recommendations: r.anecdotalRecord.notesRecommendationsActions ?? "",
    confidentiality: r.anecdotalRecord.confidentialityLevel,
    notes: r.notes ?? "",
    escalationReason: r.escalationReason ?? "",
    escalatedTo: r.escalatedTo ?? "",
    followUpDate: r.followUpDate ? r.followUpDate.toISOString().slice(0, 10) : "",
    priority: r.priority ?? "",
    intakeNotes: r.intakeNotes ?? "",
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString().slice(0, 10) : "",
    resolutionSummary: r.resolutionSummary ?? "",
    sessions: r.counselingSessions.map((s) => ({
      id: s.id,
      sessionType: s.sessionType,
      scheduledAt: s.scheduledAt.toISOString(),
      date: s.scheduledAt.toISOString().slice(0, 10),
      venue: s.venue ?? "",
      status: s.status,
      sessionNotes: s.sessionNotes ?? "",
      outcome: s.outcome ?? "",
      cancelReason: s.cancelReason ?? "",
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString().slice(0, 10) : "",
      attachments: (s.attachments ?? []).map((a) => ({
        id: a.id,
        fileUrl: a.fileUrl,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt.toISOString(),
      })),
    })),
    completedSessions: r.counselingSessions.filter((s) => s.status === "completed").length,
  }));

  const refIds = mapped.map((r) => r.id);
  const dismissedByRole = new Map<string, string>();
  if (refIds.length > 0) {
    const dismissalLogs = await prisma.auditLog.findMany({
      where: {
        sourceTable: "referrals",
        sourceId: { in: refIds },
        actionType: "referral_dismissed",
      },
      select: { sourceId: true, user: { select: { role: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const log of dismissalLogs) {
      if (!dismissedByRole.has(log.sourceId)) {
        dismissedByRole.set(log.sourceId, String(log.user?.role ?? ""));
      }
    }
  }
  const sessIds = mapped.flatMap((r) => r.sessions.map((s) => s.id));

  const cancelledByRole = await sessionCancelledByRole(sessIds);
  for (const r of mapped) {
    for (const s of r.sessions as { id: string; cancelledByRole?: string | null }[]) {
      s.cancelledByRole = cancelledByRole.get(s.id) ?? null;
    }
  }
  const lastActionById = new Map<string, { type: string; at: string }>();
  if (refIds.length > 0 || sessIds.length > 0) {
    const latestLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          ...(refIds.length ? [{ sourceTable: "referrals", sourceId: { in: refIds } }] : []),
          ...(sessIds.length ? [{ sourceTable: "counseling_sessions", sourceId: { in: sessIds } }] : []),
        ],
      },
      select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const sessionToReferral = new Map<string, string>();
    for (const r of mapped) {
      for (const s of r.sessions) sessionToReferral.set(s.id, r.id);
    }
    for (const log of latestLogs) {
      const referralId =
        log.sourceTable === "referrals"
          ? log.sourceId
          : (sessionToReferral.get(log.sourceId) ?? null);
      if (!referralId || lastActionById.has(referralId)) continue;
      lastActionById.set(referralId, {
        type: String(log.actionType),
        at: log.createdAt.toISOString(),
      });
    }
  }
  const withAction = mapped.map((r) => ({
    ...r,
    lastActionAt: lastActionById.get(r.id)?.at ?? null,
    lastActionType: lastActionById.get(r.id)?.type ?? null,
    dismissedByRole: dismissedByRole.get(r.id) ?? null,
  }));

  const referrals = withAction;

  const typeClause = (t: "ADM" | "Counseling"): any =>
    t === "ADM"
      ? { OR: [{ escalatedTo: "adm_coordinator" }, { referredToRole: "adm_coordinator" }] }
      : {
          AND: [
            { OR: [{ escalatedTo: null }, { escalatedTo: { not: "adm_coordinator" } }] },
            { referredToRole: { not: "adm_coordinator" } },
          ],
        };
  const scopedFor = (t: "ADM" | "Counseling"): any => ({ AND: [...scopeClauses, typeClause(t)] });
  const openClause = { status: { notIn: ["resolved", "dismissed"] } };
  const bookedClause = { counselingSessions: { some: {} } };
  const doneClause = { counselingSessions: { some: { status: "completed" } } };

  const dismissedScope = await prisma.referral.findMany({
    where: { AND: [...scopeClauses, { status: "dismissed" }] },
    select: { id: true, escalatedTo: true, referredToRole: true },
  });
  const cancelledIds = new Set<string>();
  if (dismissedScope.length > 0) {
    const cancelLogs = await prisma.auditLog.findMany({
      where: {
        sourceTable: "referrals",
        sourceId: { in: dismissedScope.map((d) => d.id) },
        actionType: "referral_dismissed",
        user: { role: { in: ["adviser", "subject_teacher"] } },
      },
      select: { sourceId: true },
    });
    for (const l of cancelLogs) cancelledIds.add(l.sourceId);
  }
  const cancelledOf = (t: "ADM" | "Counseling") =>
    dismissedScope.filter(
      (d) =>
        cancelledIds.has(d.id) &&
        (d.escalatedTo === "adm_coordinator" || d.referredToRole === "adm_coordinator"
          ? "ADM"
          : "Counseling") === t,
    ).length;

  const [statusGroups, admGroups, counselGroups] = await Promise.all([
    prisma.referral.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    prisma.referral.groupBy({ by: ["status"], where: scopedFor("ADM"), _count: { _all: true } }),
    prisma.referral.groupBy({ by: ["status"], where: scopedFor("Counseling"), _count: { _all: true } }),
  ]);
  const countOf = (groups: any[], s: string) =>
    groups.find((g) => g.status === s)?._count._all ?? 0;
  const [
    admBooked,
    admDone,
    admOpen,
    counselBooked,
    counselDone,
    counselOpen,
  ] = await Promise.all([
    prisma.referral.count({ where: { AND: [scopedFor("ADM"), bookedClause] } }),
    prisma.referral.count({ where: { AND: [scopedFor("ADM"), doneClause] } }),
    prisma.referral.count({ where: { AND: [scopedFor("ADM"), openClause] } }),
    prisma.referral.count({ where: { AND: [scopedFor("Counseling"), bookedClause] } }),
    prisma.referral.count({ where: { AND: [scopedFor("Counseling"), doneClause] } }),
    prisma.referral.count({ where: { AND: [scopedFor("Counseling"), openClause] } }),
  ]);
  const byTypeRow = (
    groups: any[],
    t: "ADM" | "Counseling",
    booked: number,
    done: number,
    open: number,
  ) => ({
    pending: countOf(groups, "pending"),
    inProgress: countOf(groups, "in_progress"),
    followUp: countOf(groups, "follow_up"),
    escalated: countOf(groups, "escalated"),
    infoRequested: countOf(groups, "info_requested"),
    resolved: countOf(groups, "resolved"),
    dismissed: countOf(groups, "dismissed"),
    cancelled: cancelledOf(t),
    booked,
    done,
    open,
  });

  return {
    summary: {
      total: unfilteredTotal,
      pending: countOf(statusGroups, "pending"),
      inProgress: countOf(statusGroups, "in_progress"),
      resolved: countOf(statusGroups, "resolved"),
      escalated: countOf(statusGroups, "escalated"),
      infoRequested: countOf(statusGroups, "info_requested"),
      dismissed: countOf(statusGroups, "dismissed"),
      followUp: countOf(statusGroups, "follow_up"),
      byType: {
        Counseling: byTypeRow(counselGroups, "Counseling", counselBooked, counselDone, counselOpen),
        ADM: byTypeRow(admGroups, "ADM", admBooked, admDone, admOpen),
      },
    },
    referrals,
    page: safePage,
    pageSize: effPageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
