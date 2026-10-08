import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName, ensureOpen, formatSession, formatWhen, getSession, getSessionReferral, isSessionType, parseScheduledAt, referralCard, truncate } from "../../modules/referrals/referrals.repository.js";
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

  if (ctx.role === "nurse") {
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You booked a clinic session for ${card.who} (${created.sessionType}, ${when}${where}).`,
      sourceId: referral.id,
    });
  }

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
