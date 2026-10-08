import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { assertActiveTerm, referralCard, truncate } from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

export async function addNote(ctx: ReferralContext, referralId: string, notes: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { notes },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_note_added", sourceTable: "referrals", sourceId: referral.id, reason: "Guidance note added", oldValue: null, newValue: { notes } });
  const card = await referralCard(referral);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `Guidance added a note on your referral for ${card.who}.`,
      sourceId: referral.id,
    });
  }

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You added a note on a referral for ${card.who}.`,
    sourceId: referral.id,
  });
  return updated;
}

export async function setFollowUp(ctx: ReferralContext, referralId: string, followUpDate: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot flag a resolved referral for follow-up");
  const followUpAt = new Date(`${followUpDate}T00:00:00`);
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "follow_up", followUpDate: followUpAt },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_follow_up", sourceTable: "referrals", sourceId: referral.id, reason: `Follow-up set for ${followUpDate}`, oldValue: { status: referral.status }, newValue: { status: "follow_up" } });
  const card = await referralCard(referral);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `A follow-up was set for your referral for ${card.who} — ${followUpDate}.`,
      sourceId: referral.id,
    });
  }

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You set a follow-up for ${card.who} — ${followUpDate}.`,
    sourceId: referral.id,
  });
  return updated;
}

export async function dismissReferral(ctx: ReferralContext, referralId: string, reason: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Referral already resolved");
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "dismissed", notes: reason },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
  const card = await referralCard(referral);
  const why = truncate(reason, 120);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `Your referral for ${card.who} was dismissed${why ? ` — ${why}` : ""}.`,
      sourceId: referral.id,
    });
  }

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You dismissed a referral for ${card.who}.`,
    sourceId: referral.id,
  });
  return updated;
}

export async function adviserCancel(ctx: ReferralContext, referralId: string, reason: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.referredBy !== ctx.userId) {
    throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can cancel it");
  }
  if (referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "This referral is already cancelled");
  }
  if (referral.status === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "A resolved referral cannot be cancelled");
  }
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "dismissed", notes: reason },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });

  const AUTO_CANCEL_REASON = "Auto-cancelled — referral withdrawn by the filing teacher";
  const booked = await prisma.counselingSession.findMany({
    where: { referralId: referral.id, status: "scheduled" },
    select: { id: true, status: true },
  });
  if (booked.length > 0) {
    await prisma.counselingSession.updateMany({
      where: { referralId: referral.id, status: "scheduled" },
      data: { status: "cancelled", cancelReason: AUTO_CANCEL_REASON },
    });
    for (const s of booked) {
      await writeAudit({ userId: ctx.userId, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: s.id, reason: AUTO_CANCEL_REASON, oldValue: { status: s.status }, newValue: { status: "cancelled" } });
    }
  }
  const card = await referralCard(referral);

  {
    const actorId = ctx.userId;
    const role = referral.referredToRole as
      | "nurse"
      | "guidance_counselor"
      | "adm_coordinator"
      | "principal";
    const cascadeNote =
      booked.length > 0
        ? ` (${booked.length} booked session${booked.length === 1 ? "" : "s"} auto-cancelled).`
        : "";
    void fanoutToRole(role, {
      sourceTable: "referrals",
      action: "status",
      message: `A referral to your desk was withdrawn by the filing teacher — ${card.who}.${cascadeNote}`,
      sourceId: referral.id,
      excludeUserId: actorId,
    });
    if (
      role === "adm_coordinator" &&
      (referral.consultReviewer === "nurse" ||
        referral.consultReviewer === "guidance_counselor")
    ) {
      void fanoutToRole(referral.consultReviewer, {
        sourceTable: "referrals",
        action: "status",
        message: `An ADM referral under your review was withdrawn — ${card.who}.${cascadeNote}`,
        sourceId: referral.id,
        excludeUserId: actorId,
      });
    }
    void fanoutNotification({
      userId: actorId,
      sourceTable: "referrals",
      action: "status",
      message: `You withdrew a referral for ${card.who}.${cascadeNote}`,
      sourceId: referral.id,
    });
  }
  return updated;
}

export interface ReopenInput {
  referredToRole?: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal";
  consultReviewer?: "nurse" | "guidance_counselor" | "lrpc";
}

export async function reopenReferral(ctx: ReferralContext, referralId: string, input: ReopenInput) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.referredToRole === "adm_coordinator") {
    throw new AppError(400, "INVALID_ACTION", "Cancelled ADM cases cannot be re-submitted — start a new referral from the beginning.");
  }
  if (referral.referredBy !== ctx.userId) {
    throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can re-submit it");
  }
  if (referral.status !== "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Only a cancelled referral can be re-submitted");
  }
  const nextRole = input.referredToRole ?? referral.referredToRole;
  const nextReviewer = nextRole === "adm_coordinator" ? (input.consultReviewer ?? null) : null;
  if (input.consultReviewer && nextRole !== "adm_coordinator") {
    throw new AppError(400, "INVALID_ACTION", "A consultation reviewer can only be picked for ADM cases");
  }
  if (nextRole === "adm_coordinator") {
    const studentMatch = referral.studentId
      ? { studentId: referral.studentId }
      : { rosterId: referral.rosterId };
    const existingAdm = await prisma.referral.findFirst({
      where: {
        referredToRole: "adm_coordinator",
        status: { notIn: ["dismissed", "resolved"] },
        termId: referral.termId,
        ...studentMatch,
      },
      select: { id: true },
    });
    if (existingAdm) {
      throw new AppError(409, "ADM_CASE_EXISTS", "This student already has an open ADM case — only one ADM referral per student");
    }
  }
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "pending", notes: null, referredToRole: nextRole, consultReviewer: nextReviewer },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Cancelled referral re-submitted by the filing teacher${nextRole !== referral.referredToRole ? ` (new desk: ${nextRole})` : ""}`, oldValue: { status: referral.status }, newValue: { status: "pending" } });
  const card = await referralCard(referral);

  {
    const actorId = ctx.userId;
    const role = nextRole as
      | "nurse"
      | "guidance_counselor"
      | "adm_coordinator"
      | "principal";
    const roleMessage: Record<typeof role, string> = {
      adm_coordinator: `A cancelled ADM referral was re-submitted — ${card.who}.`,
      nurse: `A cancelled clinic referral was re-submitted — ${card.who}.`,
      guidance_counselor: `A cancelled guidance referral was re-submitted — ${card.who}.`,
      principal: `A cancelled principal referral was re-submitted — ${card.who}.`,
    };

    const reviewerOwned =
      role === "adm_coordinator" &&
      (nextReviewer === "nurse" || nextReviewer === "guidance_counselor");
    if (!reviewerOwned) {
      void fanoutToRole(role, {
        sourceTable: "referrals",
        action: "status",
        message: roleMessage[role],
        sourceId: referral.id,
        excludeUserId: actorId,
      });
    }
    if (
      role === "adm_coordinator" &&
      (nextReviewer === "nurse" || nextReviewer === "guidance_counselor")
    ) {
      void fanoutToRole(nextReviewer, {
        sourceTable: "referrals",
        action: "status",
        message: `A cancelled ADM referral under your review was re-submitted — ${card.who}.`,
        sourceId: referral.id,
        excludeUserId: actorId,
      });
    }
    void fanoutNotification({
      userId: actorId,
      sourceTable: "referrals",
      action: "status",
      message: `Your cancelled referral for ${card.who} was re-submitted.`,
      sourceId: referral.id,
    });
  }
  return updated;
}

export async function deleteReferral(ctx: ReferralContext, referralId: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.referredBy !== ctx.userId) {
    throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can delete it");
  }
  if (referral.status !== "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Only a cancelled referral can be deleted");
  }
  const [sessions, profiles, meetings, visits, records] = await Promise.all([
    prisma.counselingSession.count({ where: { referralId: referral.id } }),
    prisma.admLearnerProfile.count({ where: { referralId: referral.id } }),
    prisma.admParentMeeting.count({ where: { referralId: referral.id } }),
    prisma.homeVisitationRecord.count({ where: { referralId: referral.id } }),
    prisma.healthRecord.count({ where: { referralId: referral.id } }),
  ]);
  if (sessions + profiles + meetings + visits + records > 0) {
    throw new AppError(400, "INVALID_ACTION", "This referral already has recorded activity and cannot be deleted");
  }
  await prisma.referral.delete({ where: { id: referral.id } });
  await writeAudit({ userId: ctx.userId, actionType: "delete", sourceTable: "referrals", sourceId: referral.id, reason: "Cancelled referral deleted by the filing teacher", oldValue: { status: referral.status }, newValue: null });
  const card = await referralCard(referral);

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "delete_self",
    message: `You deleted a cancelled referral for ${card.who}.`,
    sourceId: referral.id,
  });
}
