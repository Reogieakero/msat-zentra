import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { ensureNoActiveSession, ensureOpen, ensureSessionStarted, formatSession, formatWhen, getSession, getSessionReferral, isSessionType, parseScheduledAt, referralCard } from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

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

  ensureSessionStarted(session);
  if (input.followUpSession && !isSessionType(input.followUpSession.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
  }

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
