import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName, assertActiveTerm, referralCard, truncate } from "../../modules/referrals/referrals.repository.js";
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
