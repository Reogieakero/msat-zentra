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

// Guidance Counselor referrals: every behavior / incident report an adviser
// routed to guidance_counselor, newest filing first. Status-only plus the
// referrer's reason and the linked anecdotal category/date — the full
// write-up itself is opened through the case file, never listed here.
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
  // Term-scoped: prior-term cases never leak into the active term queue.
  const scopeTermId = ctx.termId;

  // Push the exact-match filters into the database so the transfer —
  // and every downstream audit fan-out — scales with the filtered
  // queue, not the whole desk. Session-gated filters (booked /
  // completed / open), free-text search, and highlight landing stay
  // in memory below because they derive from sessions or joined
  // names; their predicates are unchanged.
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
    // NOTE: `escalatedTo` is nullable — a bare `{ not: … }` would
    // drop every never-escalated case (SQL NULL semantics), so NULL
    // is matched explicitly here.
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

  const rows = await prisma.referral.findMany({
    // The desk receives direct counseling referrals PLUS ADM-track
    // cases picked for the guidance counselor as consultation
    // reviewer (same receiver scoping as the ADM page — nurse/LRPC
    // picks never land here). Both tracks render on the referrals
    // page; the mapped `type` below keeps them separable.
    where: {
      ...(scopeTermId ? { termId: scopeTermId } : {}),
      OR: [
        { referredToRole: "guidance_counselor" },
        {
          referredToRole: "adm_coordinator",
          OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
        },
      ],
      ...(dbClauses.length ? { AND: dbClauses } : {}),
    },
    orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
    take: 1000,
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

  const mapped = rows.map((r) => ({
    id: r.id,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
    // Account userId (or roster id for enlisted students without
    // accounts) for the live risk lookup — the endpoint serves both.
    studentId: r.student?.userId ?? r.roster?.id ?? null,
    // Action track: ADM-bound when already escalated toward the ADM
    // coordinator or arriving on the ADM track picked for guidance,
    // otherwise regular guidance counseling.
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

  // Who dismissed it — adviser withdrawal ("Cancelled" watermark) vs
  // desk rejection ("Reject"). Latest dismissal audit wins; rows never
  // dismissed stay null.
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
  // Who cancelled each session — desk cancel vs adviser-withdrawal
  // auto-cancel cascade. Latest session_cancelled audit wins.
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

  const filtered = withAction.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter === "adm" && r.type !== "ADM") return false;
    if (typeFilter === "counseling" && r.type !== "Counseling") return false;
    if (bookedFilter && r.sessions.length === 0) return false;
    if (completedFilter && !r.sessions.some((s) => s.status === "completed")) return false;
    if (openFilter && (r.status === "resolved" || r.status === "dismissed")) return false;
    if (
      q &&
      !`${r.student} ${r.lrn} ${r.section} ${r.referredBy} ${r.observer} ${r.reason} ${r.anecdotalExcerpt} ${r.category}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Deep-link landing (?highlight=<id>): serve the page containing the
  // case so bell links land with highlight, no extra round-trip.
  let safePage = Math.min(page, totalPages);
  if (highlight) {
    const idx = filtered.findIndex(
      (r) => (r as { id?: unknown }).id === highlight
    );
    if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
  }
  const referrals = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Adviser/subject-teacher withdrawals ("Cancelled") vs desk
  // dismissals ("Reject") — subset of dismissed, resolved from the
  // dismissal audit above. Unknown actors count as desk decisions.
  const isCancelled = (r: { status: string; id: string }) =>
    r.status === "dismissed" &&
    (dismissedByRole.get(r.id) === "adviser" ||
      dismissedByRole.get(r.id) === "subject_teacher");
  // Tile stats stay UNFILTERED; `total` is the filtered pager count.
  const unfilteredTotal = mapped.length;

  return {
    summary: {
      total: mapped.length,
      pending: mapped.filter((r) => r.status === "pending").length,
      inProgress: mapped.filter((r) => r.status === "in_progress").length,
      resolved: mapped.filter((r) => r.status === "resolved").length,
      escalated: mapped.filter((r) => r.status === "escalated").length,
      infoRequested: mapped.filter((r) => r.status === "info_requested").length,
      dismissed: mapped.filter((r) => r.status === "dismissed").length,
      followUp: mapped.filter((r) => r.status === "follow_up").length,
      // Per-track totals for the sidebar's separate ADM vs Counseling
      // menus — same statuses, counted only within each type, plus the
      // session/open gates the menus filter on.
      byType: (["Counseling", "ADM"] as const).reduce(
        (acc, type) => {
          const scoped = mapped.filter((r) => r.type === type);
          const open = scoped.filter(
            (r) => r.status !== "resolved" && r.status !== "dismissed"
          );
          acc[type] = {
            pending: scoped.filter((r) => r.status === "pending").length,
            inProgress: scoped.filter((r) => r.status === "in_progress").length,
            followUp: scoped.filter((r) => r.status === "follow_up").length,
            escalated: scoped.filter((r) => r.status === "escalated").length,
            infoRequested: scoped.filter((r) => r.status === "info_requested").length,
            resolved: scoped.filter((r) => r.status === "resolved").length,
            dismissed: scoped.filter((r) => r.status === "dismissed").length,
            cancelled: scoped.filter((r) => isCancelled(r)).length,
            booked: scoped.filter((r) => r.sessions.length > 0).length,
            done: scoped.filter((r) =>
              r.sessions.some((s) => s.status === "completed")
            ).length,
            open: open.length,
          };
          return acc;
        },
        {} as Record<
          "Counseling" | "ADM",
          {
            pending: number;
            inProgress: number;
            followUp: number;
            escalated: number;
            infoRequested: number;
            resolved: number;
            dismissed: number;
            cancelled: number;
            booked: number;
            done: number;
            open: number;
          }
        >
      ),
    },
    referrals,
    page: safePage,
    pageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
