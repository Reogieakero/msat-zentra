import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import {
  actorName,
  assertActiveTerm,
  referralCard,
  truncate,
} from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

export type ReferralStatus =
  | "pending"
  | "in_progress"
  | "resolved"
  | "escalated"
  | "info_requested"
  | "dismissed"
  | "follow_up";

export interface UpdateStatusInput {
  status: ReferralStatus;
  resolutionSummary?: string;
}

export async function updateStatus(ctx: ReferralContext, referralId: string, input: UpdateStatusInput) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  // ADM consultation-stage cases move through the review endpoint, not
  // raw status edits — otherwise the pipeline (consult → parent meeting
  // → certification) is bypassed silently.
  if (ctx.role === "nurse" && referral.referredToRole === "adm_coordinator") {
    const profileCount = await prisma.admLearnerProfile.count({
      where: { referralId: referral.id },
    });
    if (
      referral.consultReviewer === "nurse" &&
      profileCount === 0 &&
      referral.status === "pending"
    ) {
      throw new AppError(
        400,
        "USE_REVIEW_ENDPOINT",
        "ADM cases move through consultation review — use the ADM review action"
      );
    }
  }
  if (
    ctx.role === "guidance_counselor" &&
    referral.referredToRole !== "guidance_counselor"
  ) {
    throw new AppError(403, "FORBIDDEN", "Not routed to guidance");
  }
  if (referral.status === input.status) return { result: referral, changed: false };
  // Strict close-out for guidance cases: finishing at least one
  // counseling session plus a closing summary is mandatory.
  const resolvingGuidanceCase =
    input.status === "resolved" &&
    referral.referredToRole === "guidance_counselor" &&
    referral.status !== "resolved";
  if (resolvingGuidanceCase) {
    const doneCount = await prisma.counselingSession.count({
      where: { referralId: referral.id, status: "completed" },
    });
    if (doneCount === 0) {
      throw new AppError(400, "RESOLVE_BLOCKED", "Finish at least one counseling session before resolving this case");
    }
    if (!input.resolutionSummary) {
      throw new AppError(400, "RESOLVE_BLOCKED", "A closing summary is required to resolve this case");
    }
  }
  // Clinic close-out (nurse desk: direct + escalated-to-nurse cases):
  // review → accept → ≥1 completed clinic session → done. Documentation
  // (images / notes) stays optional and never blocks resolve — only the
  // completed session does. Resolving straight from pending/escalated
  // (skipping Start handling) is rejected so the review step can't be
  // bypassed silently.
  const onNurseClinicDesk =
    referral.referredToRole === "nurse" ||
    (referral.status === "escalated" && referral.escalatedTo === "nurse");
  const resolvingClinicCase =
    input.status === "resolved" &&
    onNurseClinicDesk &&
    referral.status !== "resolved";
  if (resolvingClinicCase) {
    if (
      referral.status === "pending" ||
      (referral.status === "escalated" && referral.escalatedTo === "nurse")
    ) {
      throw new AppError(
        400,
        "RESOLVE_BLOCKED",
        "Start handling this case first — review the details and accept it before marking it done"
      );
    }
    const doneCount = await prisma.counselingSession.count({
      where: { referralId: referral.id, status: "completed" },
    });
    if (doneCount === 0) {
      throw new AppError(
        400,
        "RESOLVE_BLOCKED",
        "Finish at least one clinic session before marking this case done"
      );
    }
  }
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: input.status,
      ...(resolvingGuidanceCase
        ? {
            resolutionSummary: input.resolutionSummary,
            resolvedAt: new Date(),
          }
        : resolvingClinicCase
          ? {
              ...(input.resolutionSummary
                ? { resolutionSummary: input.resolutionSummary }
                : {}),
              resolvedAt: new Date(),
            }
          : {}),
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Status → ${input.status}`, oldValue: { status: referral.status }, newValue: { status: input.status } });
  const card = await referralCard(referral);
  // Realtime handoff: the filing adviser learns the case moved — clinic
  // matters notify the adviser only (never the coordinator). Best-effort.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const nextStatus = String(input.status);
    const isClinic = onNurseClinicDesk || ctx.role === "nurse";
    const isGuidance =
      referral.referredToRole === "guidance_counselor" ||
      ctx.role === "guidance_counselor";
    let message = `Your referral for ${card.who} was updated.`;
    if (nextStatus === "resolved") {
      message = isClinic
        ? `Clinic resolved your referral for ${card.who} — case closed.`
        : isGuidance
          ? `Guidance resolved your referral for ${card.who} — case closed.`
          : `Your referral for ${card.who} was marked resolved.`;
    } else if (nextStatus === "info_requested") {
      message = isClinic
        ? `Clinic requested more info on your referral for ${card.who}.`
        : `More info was requested on your referral for ${card.who}.`;
    } else if (nextStatus === "follow_up") {
      message = isClinic
        ? `Clinic set a follow-up for ${card.who}.`
        : `A follow-up was set for your referral for ${card.who}.`;
    } else if (nextStatus === "in_progress") {
      message = isClinic
        ? `The clinic started handling your referral for ${card.who}.`
        : `Your referral for ${card.who} is now in progress.`;
    } else if (nextStatus === "dismissed") {
      message = isClinic
        ? `Your clinic referral for ${card.who} was closed.`
        : `Your referral for ${card.who} was dismissed.`;
    } else if (nextStatus === "escalated") {
      message = `Your referral for ${card.who} was escalated.`;
    } else if (nextStatus === "pending") {
      message = `Your referral for ${card.who} is pending review again.`;
    }
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message,
      sourceId: referral.id,
    });
  }
  // Nurse receipt: the acting nurse also gets a bell row (not just the
  // local success toast) so their inbox reflects what they did.
  if (ctx.role === "nurse") {
    const nextStatus = String(input.status);
    let selfMessage: string | null = null;
    if (nextStatus === "resolved") {
      selfMessage = `You marked a clinic referral for ${card.who} resolved — case closed.`;
    } else if (nextStatus === "info_requested") {
      selfMessage = `You requested more info on a clinic referral for ${card.who}.`;
    } else if (nextStatus === "follow_up") {
      selfMessage = `You set a follow-up on a clinic referral for ${card.who}.`;
    } else if (nextStatus === "in_progress") {
      selfMessage = `You started handling a clinic referral for ${card.who}.`;
    } else if (nextStatus === "dismissed") {
      selfMessage = `You closed a clinic referral for ${card.who}.`;
    } else if (nextStatus === "escalated") {
      selfMessage = `You escalated a clinic referral for ${card.who}.`;
    } else if (nextStatus === "pending") {
      selfMessage = `You moved a clinic referral for ${card.who} back to pending.`;
    }
    if (selfMessage) {
      void fanoutNotification({
        userId: ctx.userId,
        sourceTable: "referrals",
        action: "status",
        message: selfMessage,
        sourceId: referral.id,
      });
    }
  }
  // Counselor receipt: same bell-row bargain for the acting counselor.
  if (ctx.role === "guidance_counselor") {
    const nextStatus = String(input.status);
    let selfMessage: string | null = null;
    if (nextStatus === "resolved") {
      selfMessage = `You marked a guidance referral for ${card.who} resolved — case closed.`;
    } else if (nextStatus === "info_requested") {
      selfMessage = `You requested more info on a guidance referral for ${card.who}.`;
    } else if (nextStatus === "follow_up") {
      selfMessage = `You set a follow-up on a guidance referral for ${card.who}.`;
    } else if (nextStatus === "in_progress") {
      selfMessage = `You started handling a guidance referral for ${card.who}.`;
    } else if (nextStatus === "dismissed") {
      selfMessage = `You closed a guidance referral for ${card.who}.`;
    } else if (nextStatus === "pending") {
      selfMessage = `You moved a guidance referral for ${card.who} back to pending.`;
    }
    if (selfMessage) {
      void fanoutNotification({
        userId: ctx.userId,
        sourceTable: "referrals",
        action: "status",
        message: selfMessage,
        sourceId: referral.id,
      });
    }
  }
  return { result: updated, changed: true };
}

export interface EscalateInput {
  escalationReason: string;
  escalatedTo: "principal" | "nurse" | "adm_coordinator";
}

export async function escalate(ctx: ReferralContext, referralId: string, input: EscalateInput) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot escalate a resolved referral");
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: "escalated",
      escalationReason: input.escalationReason,
      escalatedTo: input.escalatedTo,
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_escalated", sourceTable: "referrals", sourceId: referral.id, reason: input.escalationReason, oldValue: { status: referral.status }, newValue: { status: "escalated", escalatedTo: input.escalatedTo } });
  const card = await referralCard(referral);
  const why = truncate(input.escalationReason, 120);
  const actor = await actorName(ctx.userId);
  // Escalation handoff: the receiving desk learns immediately — each
  // recipient's row names the actor AND the recipient ("…to you, {name}").
  if (input.escalatedTo === "nurse") {
    void fanoutToRole("nurse", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was escalated to the clinic — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
    });
  } else if (input.escalatedTo === "adm_coordinator") {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was escalated to ADM — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
    });
  } else if (input.escalatedTo === "principal") {
    void fanoutToRole("principal", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was escalated to the principal — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
    });
  }
  // The filing adviser learns where the case went — naming the actor.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const dest =
      input.escalatedTo === "nurse"
        ? "the clinic"
        : input.escalatedTo === "adm_coordinator"
          ? "ADM"
          : "the principal";
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} escalated your referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  // Counselor receipt: bell row for the acting counselor.
  {
    const dest =
      input.escalatedTo === "nurse"
        ? "the clinic"
        : input.escalatedTo === "adm_coordinator"
          ? "ADM"
          : "the principal";
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You escalated a referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  return updated;
}

export async function reassign(
  ctx: ReferralContext,
  referralId: string,
  referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal",
) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot reassign a resolved referral");
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { referredToRole, escalatedTo: null },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_reassigned", sourceTable: "referrals", sourceId: referral.id, reason: `Reassigned to ${referredToRole}`, oldValue: { referredToRole: referral.referredToRole }, newValue: { referredToRole } });
  const card = await referralCard(referral);
  const actor = await actorName(ctx.userId);
  // Reassignment handoff: the new owning desk learns immediately — each
  // recipient's row names the actor AND the recipient.
  if (referredToRole === "nurse") {
    void fanoutToRole("nurse", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was reassigned to the clinic — ${card.who}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
    });
  } else if (referredToRole === "adm_coordinator") {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was reassigned to ADM — ${card.who}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
    });
  } else if (referredToRole === "guidance_counselor") {
    void fanoutToRole("guidance_counselor", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was reassigned to guidance — ${card.who}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
    });
  }
  // The filing adviser learns where the case went — naming the actor.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const dest =
      referredToRole === "nurse"
        ? "the clinic"
        : referredToRole === "adm_coordinator"
          ? "ADM"
          : referredToRole === "guidance_counselor"
            ? "guidance"
            : "the principal";
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} reassigned your referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  // Counselor receipt: bell row for the acting counselor.
  {
    const dest =
      referredToRole === "nurse"
        ? "the clinic"
        : referredToRole === "adm_coordinator"
          ? "ADM"
          : referredToRole === "guidance_counselor"
            ? "guidance"
            : "the principal";
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You reassigned a referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  return updated;
}

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
  // Counselor receipt: bell row for the acting counselor.
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
  // Counselor receipt: bell row for the acting counselor.
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
  // Counselor receipt: bell row for the acting counselor.
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
  // Cascade: booked (still-scheduled) sessions die with the referral —
  // a withdrawn case must never keep an upcoming booking on any desk's
  // calendar. Completed sessions stay as history; only scheduled ones
  // flip, each with its own audit so timelines stay truthful.
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
  // Realtime handoff (background, off the critical path): the receiving
  // desk learns the case was withdrawn, the consultation reviewer (if
  // any) stops work, and the filing teacher gets a bell confirmation.
  // Best-effort — never delays the response.
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
  // Realtime handoff (background, off the critical path): the receiving
  // desk, the consultation reviewer (if any), and the filing teacher all
  // learn the case is live again. Best-effort — never delays the response.
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
    // Step-scoped notify (mirrors filing): a re-submitted ADM case with
    // a nurse/guidance reviewer sits at the reviewer's step — only the
    // reviewer is pinged, and the coordinator learns about it at endorse
    // time. Direct and lrpc re-submits still ping the coordinator.
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
  // Filer receipt: the bell keeps the row even though the case is gone.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "delete_self",
    message: `You deleted a cancelled referral for ${card.who}.`,
    sourceId: referral.id,
  });
}
