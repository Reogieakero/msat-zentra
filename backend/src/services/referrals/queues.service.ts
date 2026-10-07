import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import { ADM_STAGE_FLOW } from "../adm.js";
import {
  TIMELINE_DESK_LABELS,
  buildCaseTimeline,
} from "../../modules/referrals/timeline.js";
import type { ReferralContext } from "./referral.types.js";

export interface QueueListQuery {
  hasPaginationParams: boolean;
  page: number;
  pageSize: number;
  q: string;
  track: string;
  status: string;
  highlight: string;
}

// Receiver-scoped desk queue: never leak another role's referrals + full
// anecdotal write-ups to the caller. The nurse desk only receives
// clinic-routed cases, escalations to the nurse, and ADM-track cases
// where the teacher picked the nurse as consultation reviewer —
// guidance-picked / LRPC-picked ADM cases stay invisible here.
export async function listQueue(ctx: ReferralContext, query: QueueListQuery) {
  const { hasPaginationParams, page, pageSize, q, track, status, highlight } = query;
  const role = ctx.role;
  // Term-scoped: prior-term cases never leak into the active term queue.
  const scopeTermId = ctx.termId;
  // Typed as `any` — string literals here are Prisma ReferralTarget /
  // ReferralStatus enums; a strict WhereInput annotation would reject
  // the ternary union without adding safety.
  const roleWhere: any =
    role === "nurse"
      ? {
          OR: [
            { referredToRole: "nurse" },
            { status: "escalated", escalatedTo: "nurse" },
            { referredToRole: "adm_coordinator", consultReviewer: "nurse" },
          ],
        }
      : role === "guidance_counselor"
        ? { referredToRole: "guidance_counselor" }
        : role === "adm_coordinator"
          ? {
              OR: [
                { referredToRole: "adm_coordinator" },
                { status: "escalated", escalatedTo: "adm_coordinator" },
              ],
            }
          : undefined;
  // Combine role scope with the active term — every queue row is saved
  // under its filing term, so filtering here stops prior-term cases
  // leaking into the current desk.
  const scopeClauses: any[] = [];
  if (roleWhere) scopeClauses.push(roleWhere);
  if (scopeTermId) scopeClauses.push({ termId: scopeTermId });
  // Track filter: ADM consultations vs clinic matters. Clinic messages
  // never name "ADM"; ADM-track rows are coordinator-routed.
  if (track === "adm") scopeClauses.push({ referredToRole: "adm_coordinator" });
  else if (track === "clinic")
    scopeClauses.push({ referredToRole: { not: "adm_coordinator" } });
  // Status filter: comma-separated referral statuses.
  if (status.trim()) {
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) scopeClauses.push({ status: { in: statuses } });
  }
  const where: any =
    scopeClauses.length === 0
      ? undefined
      : scopeClauses.length === 1
        ? scopeClauses[0]
        : { AND: scopeClauses };
  // Two-phase read: the queue can hold hundreds of cases, but a page
  // renders 15. Phase 1 fetches a LIGHT row per case (scalars + names
  // only — no sessions, no attachments, no full write-ups) to sort and
  // filter in memory; phase 2 fetches the FULL payload for the 15 ids
  // on the requested page only. Ordering, search, highlight landing,
  // and response shapes are unchanged — only the transferred bytes and
  // the audit-log fan-out shrink. Legacy callers without pagination
  // params keep the previous full-array behavior.
  let unfilteredTotal = 0;
  let filteredTotal = 0;
  let safePage = page;
  const referrals: any[] = await (async () => {
    if (!hasPaginationParams) {
      return prisma.referral.findMany({
        where,
        include: {
          anecdotalRecord: true,
          student: { include: { section: { select: { name: true } } } },
          roster: { include: { section: { select: { name: true } } } },
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
        },
        orderBy: { id: "asc" },
      });
    }
    const light = await prisma.referral.findMany({
      where,
      select: {
        id: true,
        reason: true,
        status: true,
        notes: true,
        anecdotalRecord: {
          select: {
            observationDatetime: true,
            descriptionOfIncident: true,
          },
        },
        student: {
          select: {
            lrn: true,
            user: { select: { fullName: true } },
            section: { select: { name: true } },
          },
        },
        roster: {
          select: {
            fullName: true,
            lrn: true,
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });
    const lightIds = light.map((r) => r.id);
    const lightLogs = lightIds.length
      ? await prisma.auditLog.findMany({
          where: { sourceTable: "referrals", sourceId: { in: lightIds } },
          select: { sourceId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const lightReferredAt = new Map<string, string>();
    for (const log of lightLogs) {
      if (!lightReferredAt.has(log.sourceId)) {
        lightReferredAt.set(log.sourceId, log.createdAt.toISOString());
      }
    }
    const lightAt = (r: { id: string; anecdotalRecord?: { observationDatetime?: Date | null } | null }) =>
      lightReferredAt.get(r.id) ??
      (r.anecdotalRecord?.observationDatetime as unknown as Date | undefined)?.toISOString?.() ??
      "";
    const ordered = [...light].sort((a, b) => {
      const at = lightAt(a);
      const bt = lightAt(b);
      if (at === bt) return 0;
      return bt < at ? -1 : 1;
    });
    unfilteredTotal = ordered.length;
    const qFiltered = q
      ? ordered.filter((r) => {
          const hay = [
            (r as { reason?: unknown }).reason,
            (r as { status?: unknown }).status,
            (r as { notes?: unknown }).notes,
            (r as { student?: { user?: { fullName?: unknown } } }).student
              ?.user?.fullName,
            (r as { roster?: { fullName?: unknown } }).roster?.fullName,
            (r as {
              student?: { section?: { name?: unknown } };
            }).student?.section?.name,
            (r as { roster?: { section?: { name?: unknown } } }).roster
              ?.section?.name,
            (r as { anecdotalRecord?: { descriptionOfIncident?: unknown } })
              .anecdotalRecord?.descriptionOfIncident,
          ]
            .filter((v) => typeof v === "string")
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : ordered;
    filteredTotal = qFiltered.length;
    const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
    safePage = Math.min(page, totalPages);
    if (highlight) {
      const idx = qFiltered.findIndex(
        (r) => (r as { id?: unknown }).id === highlight
      );
      if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
    }
    const start = (safePage - 1) * pageSize;
    const pageIds = qFiltered.slice(start, start + pageSize).map((r) => r.id);
    if (pageIds.length === 0) return [];
    const pageRows = await prisma.referral.findMany({
      where: { id: { in: pageIds } },
      include: {
        anecdotalRecord: true,
        student: { include: { section: { select: { name: true } } } },
        roster: { include: { section: { select: { name: true } } } },
        // Clinic/counseling sessions per case (oldest first) so the nurse
        // referrals page renders the same counseling-plan workflow as the
        // guidance referrals page without extra round-trips.
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
      },
    });
    const order = new Map(pageIds.map((id, i) => [id, i]));
    return pageRows.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  })();
  // Referral time = earliest audit entry for the referral (creation
  // always writes one). Legacy rows without an audit trail fall back
  // to the observation date so "waiting" never goes blank.
  // Last action = latest audit across the referral row AND its sessions
  // (session booked/done/cancelled/moved + status changes) so the DUI
  // shows the execution time, not the future appointment time.
  const ids = referrals.map((r) => r.id);
  const sessionIds = referrals.flatMap((r: any) => r.counselingSessions.map((s: any) => s.id));
  const logs = ids.length
    ? await prisma.auditLog.findMany({
        where: { sourceTable: "referrals", sourceId: { in: ids } },
        select: { sourceId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const referredAtById = new Map<string, string>();
  for (const log of logs) {
    if (!referredAtById.has(log.sourceId)) {
      referredAtById.set(log.sourceId, log.createdAt.toISOString());
    }
  }
  // Who dismissed it — adviser withdrawal ("Cancelled" watermark) vs
  // desk rejection ("Reject"). Latest dismissal audit wins; rows never
  // dismissed stay null.
  const dismissedByRole = new Map<string, string>();
  if (ids.length > 0) {
    const dismissalLogs = await prisma.auditLog.findMany({
      where: {
        sourceTable: "referrals",
        sourceId: { in: ids },
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
  // Who cancelled each session — desk cancel vs the adviser-withdrawal
  // auto-cancel cascade (audit actor is the filing teacher there).
  const cancelledByRole = await sessionCancelledByRole(sessionIds);
  // Latest execution per referral: newest referral-level audit wins
  // unless a session-level audit on one of its sessions is newer.
  const lastActionById = new Map<string, { type: string; at: string }>();
  if (ids.length > 0 || sessionIds.length > 0) {
    const latestLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          ...(ids.length ? [{ sourceTable: "referrals", sourceId: { in: ids } }] : []),
          ...(sessionIds.length ? [{ sourceTable: "counseling_sessions", sourceId: { in: sessionIds } }] : []),
        ],
      },
      select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const sessionToReferral = new Map<string, string>();
    for (const r of referrals) {
      for (const s of r.counselingSessions) sessionToReferral.set(s.id, r.id);
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
  const enriched = referrals
    .map((r) => ({
      ...r,
      counselingSessions: r.counselingSessions.map((s: any) => ({
        ...s,
        cancelledByRole: cancelledByRole.get(s.id) ?? null,
      })),
      referredAt:
        referredAtById.get(r.id) ??
        r.anecdotalRecord?.observationDatetime?.toISOString() ??
        null,
      lastActionAt: lastActionById.get(r.id)?.at ?? null,
      lastActionType: lastActionById.get(r.id)?.type ?? null,
      dismissedByRole: dismissedByRole.get(r.id) ?? null,
    }))
    // Latest referred on top — the nurse referrals queue is a
    // newest-first timeline. (Referral ids are uuids, so the DB
    // orderBy above carries no chronology; referredAt does.)
    .sort((a, b) => {
      const at = (a as { referredAt?: string | null }).referredAt ?? "";
      const bt = (b as { referredAt?: string | null }).referredAt ?? "";
      if (at === bt) return 0;
      return bt < at ? -1 : 1;
    });
  // Legacy shape: no pagination params → bare array (other desks).
  if (!hasPaginationParams) {
    return enriched;
  }
  // Paging, filtering, and highlight landing were resolved in the
  // two-phase read above (`unfilteredTotal`/`filteredTotal`/`safePage`
  // computed over the light rows); `enriched` already holds exactly
  // the requested page in display order. Tile stats stay UNFILTERED
  // so searching never shrinks the tiles; `total` is the filtered
  // pager count.
  const rows = enriched;
  return {
    data: rows,
    rows,
    referrals: rows,
    total: filteredTotal,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: filteredTotal },
    page: safePage,
    totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
    limit: pageSize,
    pageSize,
  };
}

export interface MineQuery {
  hasPaginationParams: boolean;
  page: number;
  pageSize: number;
  q: string;
  highlight: string;
}

// Teacher-scoped referrals: returns referrals where the teacher is the referrer
// (referredBy = me), narrowed to their advisory sections' students. Adviser-only
// (404 if the teacher has no advisory section). Subject teachers may also read
// referrals they originated.
export async function listMine(ctx: ReferralContext, query: MineQuery) {
  const { hasPaginationParams, page, pageSize, q, highlight } = query;
  const teacherId = ctx.userId;
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true, name: true, gradeLevel: true },
  });
  if (sections.length === 0 && ctx.role === "adviser") {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  const sectionIds = sections.map((s) => s.id);
  // Term-scoped: a referral filed in another term never leaks into this
  // term's list — each term shows only transactions executed under it.
  // Linking the teacher code again in a new term grants access; it does
  // not copy prior terms' rows over.
  const scopeTermId = ctx.termId;
  const referralWhere = {
    referredBy: teacherId,
    ...(scopeTermId ? { termId: scopeTermId } : {}),
    ...(sectionIds.length > 0
      ? {
          OR: [
            { student: { sectionId: { in: sectionIds } } },
            { roster: { sectionId: { in: sectionIds } } },
          ],
        }
      : {}),
  };
  const referrals = await prisma.referral.findMany({
    where: referralWhere,
    include: {
      student: {
        select: {
          lrn: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: {
          lrn: true,
          fullName: true,
          section: { select: { name: true } },
        },
      },
      anecdotalRecord: {
        select: {
          id: true,
          observationDatetime: true,
          category: true,
          confidentialityLevel: true,
          descriptionOfIncident: true,
          notesRecommendationsActions: true,
        },
      },
      // Real follow-through evidence (status-only for teachers — no
      // clinical text leaves this endpoint).
      homeVisitations: { select: { id: true } },
      admProfiles: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          stage: true,
          eligibilityStatus: true,
          approvedBy: true,
          approvedAt: true,
          createdAt: true,
          parentMeetings: {
            orderBy: { meetingDatetime: "desc" },
            take: 5,
            select: { attended: true, meetingDatetime: true },
          },
          modules: { select: { submitted: true, submissionDate: true } },
          devices: { select: { returnedDate: true } },
          forms: { select: { formType: true, status: true, uploadedAt: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  });

  const referralIds = referrals.map((r) => r.id);
  // Shared audit timeline (referral + session actions, actor roles,
  // full timestamps) — same builder the ADM my-cases endpoint uses.
  const timelines = await buildCaseTimeline(referralIds);
  // Approver roles for the principal-signature entries (one query).
  const approverIds = [
    ...new Set(
      referrals
        .map((r) => r.admProfiles[0]?.approvedBy ?? null)
        .filter((v): v is string => !!v)
    ),
  ];
  const approverRoles = new Map<string, string>();
  if (approverIds.length > 0) {
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, role: true },
    });
    for (const a of approvers) approverRoles.set(a.id, String(a.role));
  }

  const admLabelByStage = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

  const formatted = referrals.map((r) => {
    const isAdm = r.referredToRole === "adm_coordinator";
    const profile = r.admProfiles[0] ?? null;
    const meetings = profile?.parentMeetings ?? [];
    const hasParentMeeting = meetings.length > 0;
    const meetingAttended = meetings.length > 0 ? meetings.some((m) => m.attended) : null;
    const hasHomeVisit = r.homeVisitations.length > 0;
    // Canonical ADM stage enum (anecdotal → … → completion). A fresh ADM
    // referral with no profile yet sits at consultation.
    const admStage = isAdm ? (profile?.stage ?? "consultation") : null;

    const timeline = timelines.get(r.id) ?? [];
    const referredAt =
      timeline[0]?.at ?? new Date().toISOString();
    if (timeline.length === 0) {
      timeline.push({
        label: `Submitted to the ${TIMELINE_DESK_LABELS[r.referredToRole] ?? "receiving desk"}.`,
        detail: null,
        date: referredAt.slice(0, 10),
        at: referredAt,
        action: "referral_submitted",
        byRole: null,
        source: "case",
      });
    }
    if (profile) {
      timeline.push({
        label: `Moved to the ${admLabelByStage.get(profile.stage) ?? profile.stage} stage.`,
        detail: null,
        date: profile.createdAt.toISOString().slice(0, 10),
        at: profile.createdAt.toISOString(),
        action: "adm_stage",
        byRole: "adm_coordinator",
        source: "case",
        stage: profile.stage,
      });
    }
    if (profile?.approvedBy && profile.approvedAt) {
      timeline.push({
        label: "The principal signed the approval.",
        detail: null,
        date: profile.approvedAt.toISOString().slice(0, 10),
        at: profile.approvedAt.toISOString(),
        action: "adm_approved",
        byRole: approverRoles.get(profile.approvedBy) ?? "principal",
        source: "case",
      });
    }

    return {
      id: r.id,
      studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
      lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
      section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
      targetRole: r.referredToRole,
      referredBy: r.referredBy,
      reason: r.reason,
      status: r.status,
      referredAt,
      resolvedAt: r.status === "resolved" ? (timeline[timeline.length - 1]?.at ?? new Date().toISOString()) : null,
      anecdotalId: r.anecdotalRecordId,
      observationDate: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
      category: r.anecdotalRecord.category,
      track: isAdm ? "adm" : "general",
      // Truthful routing: the teacher-picked consultation reviewer, or
      // the coordinator for legacy rows without a stored pick.
      admReceiver: isAdm ? (r.consultReviewer ?? "adm_coordinator") : null,
      consultReviewer: r.consultReviewer ?? null,
      hasParentMeeting,
      meetingAttended,
      hasHomeVisit,
      admStage,
      admStageLabel: admStage ? (admLabelByStage.get(admStage) ?? admStage) : null,
      admEligibility: profile?.eligibilityStatus ?? null,
      admApproved: !!profile?.approvedBy,
      admApprovedAt: profile?.approvedAt ? profile.approvedAt.toISOString() : null,
      // Stage evidence for the shared tracker (status-only counts and
      // timestamps — same shape as adm/my-cases so both pages match).
      modulesSubmitted: (profile?.modules ?? []).filter((m) => m.submitted).length,
      modulesTotal: (profile?.modules ?? []).length,
      lastModuleAt: (() => {
        const dates = (profile?.modules ?? [])
          .filter((m) => m.submitted && m.submissionDate)
          .map((m) => (m.submissionDate as Date).toISOString());
        return dates.length > 0 ? dates.sort().slice(-1)[0] : null;
      })(),
      devicesReturned: (profile?.devices ?? []).filter((d) => d.returnedDate !== null).length,
      certificationAt: (() => {
        const cert = (profile?.forms ?? []).find(
          (f) => f.formType === "CERTIFICATION" && f.status === "verified" && f.uploadedAt
        );
        return cert?.uploadedAt ? (cert.uploadedAt as Date).toISOString() : null;
      })(),
      lastMeetingAt:
        meetings.length > 0 && meetings[0].meetingDatetime
          ? (meetings[0].meetingDatetime as Date).toISOString()
          : null,
      timeline,
      notes: r.notes,
      escalationReason: r.escalationReason,
      followUpDate: r.followUpDate,
      escalatedTo: r.escalatedTo,
    };
  });

  // Legacy shape: no pagination params → bare array.
  if (!hasPaginationParams) {
    return formatted;
  }
  // Tile stats stay UNFILTERED; `total` is the filtered pager count.
  // Server search (?q=) filters here so clients never filter locally.
  const unfilteredTotal = formatted.length;
  const filtered = q
    ? formatted.filter((r) => {
        const hay = [
          r.studentName,
          r.lrn,
          r.section,
          r.reason,
          r.category,
          r.status,
          r.anecdotalExcerpt,
        ]
          .filter((v) => typeof v === "string")
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : formatted;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Deep-link landing (?highlight=<id>): serve the page containing
  // the case so bell links land with highlight, no extra round-trip.
  let safePage = Math.min(page, totalPages);
  if (highlight) {
    const idx = filtered.findIndex(
      (r) => (r as { id?: unknown }).id === highlight
    );
    if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
  }
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  return {
    data: rows,
    rows,
    referrals: rows,
    total,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: total },
    page: safePage,
    totalPages,
    limit: pageSize,
    pageSize,
  };
}
