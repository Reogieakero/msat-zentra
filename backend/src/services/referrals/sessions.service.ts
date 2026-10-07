import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import {
  actorName,
  ensureNoActiveSession,
  ensureOpen,
  ensureSessionStarted,
  formatAttachment,
  formatSession,
  formatWhen,
  getSession,
  getSessionReferral,
  isSessionType,
  parseScheduledAt,
  referralCard,
  truncate,
} from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

export async function listSessions(ctx: ReferralContext, referralId: string) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  const sessions = await prisma.counselingSession.findMany({
    where: { referralId: referral.id },
    orderBy: { scheduledAt: "asc" },
    include: {
      creator: { select: { fullName: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
    },
  });
  return sessions.map(formatSession);
}

export interface BookSessionInput {
  scheduledAt: string;
  sessionType: string;
  venue?: string;
}

export async function bookSession(ctx: ReferralContext, referralId: string, input: BookSessionInput) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  ensureOpen(referral);
  if (!isSessionType(input.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown session type");
  }
  // Atomic booking: active-session guard + create + pending→in_progress
  // flip in one transaction to close the rapid double-click race.
  const created = await prisma.$transaction(async (tx) => {
    const active = await tx.counselingSession.count({
      where: { referralId: referral.id, status: "scheduled" },
    });
    if (active > 0) {
      throw new AppError(
        400,
        "ACTIVE_SESSION_EXISTS",
        "This referral already has a session that is not done yet — finish or cancel it before booking another one"
      );
    }
    const row = await tx.counselingSession.create({
      data: {
        referralId: referral.id,
        sessionType: input.sessionType,
        scheduledAt: parseScheduledAt(input.scheduledAt),
        venue: input.venue?.trim() || null,
        status: "scheduled",
        createdBy: ctx.userId,
      },
      include: {
        creator: { select: { fullName: true } },
        attachments: { orderBy: { uploadedAt: "asc" } },
      },
    });
    // Booking is handling: a still-pending referral leaves "Needs review"
    // the moment its first session is booked (mirrors nurse-accept).
    // ADM consultations never flip here — on ADM track in_progress IS
    // the endorsed state, and endorsing happens only through the
    // explicit Create-referral/forward flow (completed form required).
    // A pre-confirm booking from the ADM review leaves the case pending.
    if (referral.status === "pending" && referral.referredToRole !== "adm_coordinator") {
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "in_progress" },
      });
    }
    return row;
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
  if (referral.status === "pending" && referral.referredToRole !== "adm_coordinator") {
    await writeAudit({ userId: ctx.userId, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: "Session booked — case now in progress", oldValue: { status: "pending" }, newValue: { status: "in_progress" } });
  }
  const card = await referralCard(referral);
  const when = formatWhen(created.scheduledAt);
  const where = created.venue ? ` at ${created.venue}` : "";
  const actor = await actorName(ctx.userId);
  const actorLabel =
    ctx.role === "nurse"
      ? `${actor} (Clinic)`
      : `${actor} (Guidance)`;
  // Session booking is handling — the filing adviser learns live, naming
  // who booked it. Clinic matters stay adviser-only (never fan out to
  // the coordinator).
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const message = `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}).`;
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message,
      sourceId: referral.id,
    });
  }
  // Consultation reviewer: on ADM-track cases the other desk's
  // reviewer (nurse ↔ guidance) learns about the booking too, so
  // everyone connected to the student — guidance, nurse, adviser —
  // is reminded live. Skipped when the reviewer is the actor.
  if (
    referral.referredToRole === "adm_coordinator" &&
    (referral.consultReviewer === "nurse" ||
      referral.consultReviewer === "guidance_counselor") &&
    referral.consultReviewer !== ctx.role
  ) {
    void fanoutToRole(referral.consultReviewer, {
      sourceTable: "referrals",
      action: "status",
      message: `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}).`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}) — sent to you, ${r.fullName}.`,
    });
  }
  // Nurse receipt: bell row for the acting nurse.
  if (ctx.role === "nurse") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You booked a clinic session for ${card.who} (${created.sessionType}, ${when}${where}).`,
      sourceId: referral.id,
    });
  }
  // Counselor receipt: bell row for the acting counselor.
  if (ctx.role === "guidance_counselor") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You booked a guidance session for ${card.who} (${created.sessionType}, ${when}${where}).`,
      sourceId: referral.id,
    });
  }
  return formatSession(created);
}

export interface CompleteSessionInput {
  sessionNotes: string;
  outcome?: string;
  followUpSession?: { scheduledAt: string; sessionType: string; venue?: string };
}

export async function completeSession(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  input: CompleteSessionInput,
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  ensureOpen(referral);
  const session = await getSession(referral.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be marked done");
  }
  // A still-upcoming session cannot be marked done — it unlocks once
  // the scheduled time arrives.
  ensureSessionStarted(session);
  if (input.followUpSession && !isSessionType(input.followUpSession.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
  }
  // The follow-up replaces this session, so other active sessions
  // (excluding this one) still block booking it.
  if (input.followUpSession) {
    await ensureNoActiveSession(referral.id, session.id);
  }
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      sessionNotes: input.sessionNotes.trim(),
      outcome: input.outcome?.trim() || null,
      completedAt: new Date(),
    },
    include: {
      creator: { select: { fullName: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_completed", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session completed", oldValue: { status: session.status }, newValue: { status: "completed" } });
  if (input.followUpSession) {
    const next = await prisma.counselingSession.create({
      data: {
        referralId: referral.id,
        sessionType: input.followUpSession.sessionType,
        scheduledAt: parseScheduledAt(input.followUpSession.scheduledAt),
        venue: input.followUpSession.venue?.trim() || null,
        status: "scheduled",
        createdBy: ctx.userId,
      },
    });
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: next.id, reason: "Follow-up session booked", oldValue: null, newValue: { sessionType: next.sessionType, scheduledAt: next.scheduledAt } });
    // Marking done WITH a follow-up counts the referral as follow-up —
    // sidebar menus, counts, and due lists key off this. Scoped to the
    // clinic/counseling desks: ADM-track referrals keep their pipeline
    // status (pending → endorsed) so consultation review still works.
    if (referral.referredToRole === "nurse" || referral.referredToRole === "guidance_counselor") {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "follow_up", followUpDate: next.scheduledAt },
      });
      await writeAudit({ userId: ctx.userId, actionType: "referral_follow_up", sourceTable: "referrals", sourceId: referral.id, reason: `Follow-up on ${next.scheduledAt.toISOString().slice(0, 10)}`, oldValue: { status: referral.status }, newValue: { status: "follow_up", followUpDate: next.scheduledAt.toISOString().slice(0, 10) } });
    }
  }
  const card = await referralCard(referral);
  const didWhen = formatWhen(session.scheduledAt);
  // The filing adviser learns the session outcome live (adviser-only —
  // clinic matters never fan out to the coordinator). Status-only: no
  // clinical notes leave this message.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const message = input.followUpSession
      ? ctx.role === "nurse"
        ? `Clinic set a follow-up for ${card.who} — next session ${formatWhen(parseScheduledAt(input.followUpSession.scheduledAt))}.`
        : `A follow-up was set for your referral for ${card.who}.`
      : ctx.role === "nurse"
        ? `Clinic completed a session for ${card.who} (${session.sessionType}, ${didWhen}).`
        : `Guidance completed a session for ${card.who} (${session.sessionType}, ${didWhen}).`;
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message,
      sourceId: referral.id,
    });
  }
  // Nurse receipt: bell row for the acting nurse.
  if (ctx.role === "nurse") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: input.followUpSession
        ? `You completed a session for ${card.who} and set a follow-up (${formatWhen(parseScheduledAt(input.followUpSession.scheduledAt))}).`
        : `You completed a clinic session for ${card.who} (${session.sessionType}, ${didWhen}).`,
      sourceId: referral.id,
    });
  }
  // Counselor receipt: bell row for the acting counselor.
  if (ctx.role === "guidance_counselor") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: input.followUpSession
        ? `You completed a session for ${card.who} and set a follow-up (${formatWhen(parseScheduledAt(input.followUpSession.scheduledAt))}).`
        : `You completed a guidance session for ${card.who} (${session.sessionType}, ${didWhen}).`,
      sourceId: referral.id,
    });
  }
  return formatSession(updated);
}

export async function rescheduleSession(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  scheduledAt: string,
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  ensureOpen(referral);
  const session = await getSession(referral.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be moved");
  }
  const nextDate = parseScheduledAt(scheduledAt);
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: { scheduledAt: nextDate },
    include: {
      creator: { select: { fullName: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_rescheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session moved", oldValue: { scheduledAt: session.scheduledAt }, newValue: { scheduledAt: nextDate } });
  const card = await referralCard(referral);
  const was = formatWhen(session.scheduledAt);
  const now = formatWhen(nextDate);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message:
        ctx.role === "nurse"
          ? `Clinic rescheduled a session for ${card.who} — now ${now} (was ${was}).`
          : `Guidance rescheduled a session for ${card.who} — now ${now} (was ${was}).`,
      sourceId: referral.id,
    });
  }
  if (ctx.role === "nurse") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You rescheduled a clinic session for ${card.who} — now ${now} (was ${was}).`,
      sourceId: referral.id,
    });
  }
  if (ctx.role === "guidance_counselor") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You rescheduled a guidance session for ${card.who} — now ${now} (was ${was}).`,
      sourceId: referral.id,
    });
  }
  return formatSession(updated);
}

export async function cancelSession(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  cancelReason?: string,
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  ensureOpen(referral);
  const session = await getSession(referral.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be cancelled");
  }
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: {
      status: "cancelled",
      cancelReason: cancelReason?.trim() || null,
    },
    include: {
      creator: { select: { fullName: true } },
      attachments: { orderBy: { uploadedAt: "asc" } },
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: session.id, reason: cancelReason?.trim() || "Counseling session cancelled", oldValue: { status: session.status }, newValue: { status: "cancelled" } });
  const card = await referralCard(referral);
  const was = formatWhen(session.scheduledAt);
  const why = truncate(cancelReason, 120);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message:
        ctx.role === "nurse"
          ? `Clinic cancelled a session for ${card.who} (${session.sessionType}, ${was})${why ? ` — ${why}` : ""}.`
          : `Guidance cancelled a session for ${card.who} (${session.sessionType}, ${was})${why ? ` — ${why}` : ""}.`,
      sourceId: referral.id,
    });
  }
  if (ctx.role === "nurse") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You cancelled a clinic session for ${card.who} (${session.sessionType}, ${was}).`,
      sourceId: referral.id,
    });
  }
  if (ctx.role === "guidance_counselor") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You cancelled a guidance session for ${card.who} (${session.sessionType}, ${was}).`,
      sourceId: referral.id,
    });
  }
  return formatSession(updated);
}

// Permanently remove a cancelled clinic/counseling session (its filed
// documentation goes with it via cascade). Only cancelled sessions can be
// deleted — scheduled sessions must be finished or cancelled first, and
// completed sessions stay as the case history.
export async function deleteSession(ctx: ReferralContext, referralId: string, sessionId: string) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  ensureOpen(referral);
  const session = await getSession(referral.id, sessionId);
  if (session.status !== "cancelled") {
    throw new AppError(400, "INVALID_ACTION", "Only a cancelled session can be deleted");
  }
  await prisma.counselingSession.delete({ where: { id: session.id } });
  await writeAudit({ userId: ctx.userId, actionType: "delete", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Cancelled session deleted", oldValue: { status: session.status }, newValue: null });
  const card = await referralCard(referral);
  // Previously silent: filer + actor both learn the session is gone.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "counseling_sessions",
      action: "delete",
      message: `A session for ${card.who} was deleted.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "counseling_sessions",
    action: "delete_self",
    message: `You deleted a clinic session for ${card.who}.`,
    sourceId: referral.id,
  });
}

// Clinic documentation on one session: list / upload / remove image
// attachments. Filing is optional before closing a clinic case — these
// operations never gate resolve, they only build the evidence trail.
// Uploads are allowed on open cases (any session status except when the
// case itself is closed) so the nurse can file a photo after marking a
// session done — but a still-upcoming session unlocks only once its
// scheduled time arrives.
export async function listAttachments(ctx: ReferralContext, referralId: string, sessionId: string) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  const session = await getSession(referral.id, sessionId);
  const rows = await prisma.clinicSessionAttachment.findMany({
    where: { sessionId: session.id },
    orderBy: { uploadedAt: "asc" },
  });
  return rows.map(formatAttachment);
}

export interface SessionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  files: SessionFile[],
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a closed case");
  }
  const session = await getSession(referral.id, sessionId);
  // Documentation unlocks once the session time arrives — upcoming
  // sessions can still be viewed but cannot take new files yet.
  if (session.status === "scheduled") {
    ensureSessionStarted(session);
  }
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.clinicSessionAttachment.count({
    where: { sessionId: session.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
  }
  const created = [];
  for (const file of files) {
    const path = clinicSessionObjectPath(session.id, file.originalname);
    const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
    const row = await prisma.clinicSessionAttachment.create({
      data: {
        sessionId: session.id,
        fileUrl,
        fileName: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: ctx.userId,
      },
    });
    created.push(row);
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });
  const card = await referralCard(referral);
  // Previously silent: filer + actor both learn documentation landed.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "session_attachments",
      action: "create",
      message: `Session documentation was added for ${card.who}.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "create_self",
    message: `You added session photos for ${card.who}.`,
    sourceId: referral.id,
  });
  return created.map(formatAttachment);
}

export async function removeAttachment(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  attachmentId: string,
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a closed case");
  }
  const session = await getSession(referral.id, sessionId);
  const row = await prisma.clinicSessionAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!row || row.sessionId !== session.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.clinicSessionAttachment.delete({ where: { id: row.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `Documentation removed: ${row.fileName}`,
    oldValue: { fileName: row.fileName },
    newValue: null,
  });
  const card = await referralCard(referral);
  // Previously silent: filer + actor both learn documentation was removed.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "session_attachments",
      action: "delete",
      message: `Session documentation was removed for ${card.who}.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "delete_self",
    message: `You removed a session photo for ${card.who}.`,
    sourceId: referral.id,
  });
  return { ok: true };
}
