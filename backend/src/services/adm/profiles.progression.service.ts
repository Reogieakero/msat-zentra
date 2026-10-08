import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { canTransition, evaluateAdmEligibility, type AdmStage } from "../adm.js";
import { actorName, ensureAdmForm } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

const ROLE_FOR_STAGE: Record<AdmStage, string[]> = {
  anecdotal: ["adviser"],
  consultation: ["guidance_counselor", "nurse"],
  meeting_parents: ["adm_coordinator"],
  home_visitation: ["guidance_counselor"],
  certification: ["adm_coordinator"],
  principal_approval: ["principal"],
  enrollment_monitoring: ["adm_coordinator"],
  completion: ["adm_coordinator"],
};

export async function advanceStage(ctx: AdmContext, profileId: string, target: AdmStage) {

  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
      referral: { select: { id: true, referredBy: true } },
      forms: { select: { formType: true, status: true } },
      parentMeetings: { select: { attended: true } },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  if (profile.stage === target) {
    return profile;
  }
  if (!canTransition(profile.stage, target)) {
    throw new AppError(
      409,
      "ADM_INVALID_TRANSITION",
      `Cannot move from ${profile.stage} to ${target}`
    );
  }
  const allowed = ROLE_FOR_STAGE[target] ?? [];
  if (!allowed.includes(ctx.role)) {
    throw new AppError(
      403,
      "FORBIDDEN_STAGE",
      `Role ${ctx.role} cannot move a case to ${target}`
    );
  }

  const data: { stage: AdmStage; eligibilityStatus?: "pending" | "eligible" | "ineligible" } = {
    stage: target,
  };
  if (
    target === "certification" ||
    target === "principal_approval" ||
    target === "enrollment_monitoring" ||
    target === "completion"
  ) {
    data.eligibilityStatus = evaluateAdmEligibility({
      stage: target,
      forms: profile.forms,
      parentMeetings: profile.parentMeetings,
    });
  } else {

    data.eligibilityStatus = "pending";
  }
  const updated = await prisma.admLearnerProfile.update({
    where: { id: profile.id },
    data,
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_learner_profiles",
    sourceId: profile.id,
    reason: `ADM stage advanced to ${target}`,
    oldValue: { stage: profile.stage },
    newValue: { stage: target },
  });

  const studentName = profile.student?.user?.fullName ?? "your student";
  const stageWords = target.replace(/_/g, " ");
  const actor = await actorName(ctx.userId);
  if (profile.referral && profile.referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: profile.referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message:
        target === "principal_approval"
          ? `${actor} endorsed the ADM case for ${studentName} to the Principal.`
          : `${actor} moved the ADM case for ${studentName} to ${stageWords}.`,
      sourceId: profile.referral.id,
    });
  }

  {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message:
        target === "principal_approval"
          ? `ADM case endorsed to the Principal.`
          : `ADM case moved to ${stageWords}.`,
      sourceId: profile.referral?.id ?? profile.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        target === "principal_approval"
          ? `${actor} endorsed the ADM case for ${studentName} to the Principal — sent to you, ${r.fullName}.`
          : `${actor} moved the ADM case for ${studentName} to ${stageWords} — sent to you, ${r.fullName}.`,
    });
  }

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_learner_profiles",
    action: target === "principal_approval" ? "endorse_self" : "decide_self",
    message:
      target === "principal_approval"
        ? `You endorsed ${studentName} to the Principal — principal_approval.`
        : `You moved ${studentName} to ${stageWords} — ${target}.`,
    sourceId: profile.id,
  });
  return updated;
}

export async function certify(ctx: AdmContext, profileId: string, recommendation: string) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    include: {
      forms: { select: { formType: true, status: true } },
      parentMeetings: { select: { attended: true } },
      student: { select: { user: { select: { fullName: true } } } },
      referral: {
        select: {
          id: true,
          referredBy: true,
          anecdotalRecordId: true,
          homeVisitations: { select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  if (
    ["principal_approval", "enrollment_monitoring", "completion"].includes(
      profile.stage,
    )
  ) {
    throw new AppError(409, "ALREADY_CERTIFIED", "Certification already recorded for this case");
  }
  if (
    !["anecdotal", "consultation", "meeting_parents", "home_visitation", "certification"].includes(
      profile.stage,
    )
  ) {
    throw new AppError(
      409,
      "NOT_AT_CERTIFICATION_STAGE",
      `Certification needs a pre-approval case (stage: ${profile.stage})`,
    );
  }
  if (!profile.parentMeetings.some((m) => m.attended)) {
    throw new AppError(409, "MEETING_REQUIRED", "Record parent meeting attendance first");
  }

  const me = ctx.userId;
  const updated = await prisma.$transaction(async (tx) => {
    await ensureAdmForm(profile.id, "REFERRAL_FORM", "Referral form", me, tx);
    if (profile.referral?.anecdotalRecordId) {
      await ensureAdmForm(profile.id, "ANECDOTAL_REPORT", "Anecdotal report", me, tx);
    }
    await ensureAdmForm(profile.id, "MINUTES_OF_MEETING", "Minutes of meeting", me, tx);
    if ((profile.referral?.homeVisitations?.length ?? 0) > 0) {
      await ensureAdmForm(profile.id, "HV_FORM", "Home visitation form", me, tx);
    }
    await ensureAdmForm(profile.id, "CERTIFICATION", "ADM certification", me, tx);
    const forms = await tx.admForm.findMany({
      where: { admLearnerProfileId: profile.id },
      select: { formType: true, status: true },
    });
    const eligibilityStatus = evaluateAdmEligibility({
      stage: "principal_approval",
      forms,
      parentMeetings: profile.parentMeetings,
    });
    const prev = profile.certificationDetails;
    const prevDetails =
      prev && typeof prev === "object" && !Array.isArray(prev)
        ? (prev as Record<string, unknown>)
        : {};
    return tx.admLearnerProfile.update({
      where: { id: profile.id },
      data: {
        stage: "principal_approval",
        eligibilityStatus,
        certificationDetails: {
          ...prevDetails,
          recommendation,
          certifiedBy: ctx.userId,
          certifiedAt: new Date().toISOString(),
        },
      },
    });
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_learner_profiles",
    sourceId: profile.id,
    reason: "ADM certification created and endorsed to Principal",
    oldValue: { stage: profile.stage },
    newValue: { stage: "principal_approval" },
  });

  const studentName = profile.student?.user?.fullName ?? "your student";
  const actor = await actorName(ctx.userId);
  if (profile.referral && profile.referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: profile.referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} certified the ADM case for ${studentName} and endorsed it to the Principal.`,
      sourceId: profile.referral.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "referrals",
    action: "status",
    message: `ADM case certified and endorsed to the Principal.`,
    sourceId: profile.referral?.id ?? profile.id,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} certified the ADM case for ${studentName} and endorsed it to the Principal — sent to you, ${r.fullName}.`,
  });
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adm_learner_profiles",
    action: "certify_self",
    message: `You certified ${studentName} and endorsed the case to the Principal — principal_approval.`,
    sourceId: profile.id,
  });
  return updated;
}

export async function principalApprove(ctx: AdmContext, profileId: string) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
      referral: { select: { id: true, referredBy: true, status: true } },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  if (profile.referral && (profile.referral.status === "dismissed" || profile.referral.status === "resolved")) {
    throw new AppError(409, "REFERRAL_CLOSED", "This referral was cancelled/resolved — meetings can no longer be booked");
  }
  if (profile.approvedBy) throw new AppError(409, "ALREADY_APPROVED", "Already signed by principal");
  if (profile.eligibilityStatus !== "eligible")
    throw new AppError(409, "NOT_CERTIFIED", "Case must pass Recommendation & Certification before School Head approval");
  if (profile.stage !== "principal_approval")
    throw new AppError(409, "NOT_AT_SCHOOL_HEAD", "Case must be at School Head (Principal) Approval before signing");
  const updated = await prisma.admLearnerProfile.update({
    where: { id: profile.id },
    data: { approvedBy: ctx.userId, approvedAt: new Date(), stage: "enrollment_monitoring" },
  });
  await writeAudit({ userId: ctx.userId, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: "Principal final signature", oldValue: { approvedBy: null }, newValue: { approvedBy: ctx.userId } });

  const studentName = profile.student?.user?.fullName ?? "your student";
  const actor = await actorName(ctx.userId);
  if (profile.referral && profile.referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: profile.referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} signed the ADM case for ${studentName}.`,
      sourceId: profile.referral.id,
    });
  }

  {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message: `ADM case for ${studentName} signed by the Principal — ready for enrollment monitoring.`,
      sourceId: profile.referral?.id ?? profile.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} signed the ADM case for ${studentName} — sent to you, ${r.fullName}.`,
    });
  }
  return updated;
}

export async function principalReturn(ctx: AdmContext, profileId: string) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: profileId },
    include: {
      student: { select: { user: { select: { fullName: true } } } },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
  if (!profile.approvedBy)
    throw new AppError(409, "NOT_YET_APPROVED", "Cannot return a profile that has not been signed");
  const updated = await prisma.admLearnerProfile.update({
    where: { id: profile.id },
    data: {
      approvedBy: null,
      approvedAt: null,
      eligibilityStatus: "pending",
      stage: "principal_approval",
    },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_learner_profiles",
    sourceId: profile.id,
    reason: "Principal returned profile to ADM Coordinator for revision",
    oldValue: { approvedBy: profile.approvedBy, eligibilityStatus: profile.eligibilityStatus },
    newValue: { approvedBy: null, eligibilityStatus: "pending" },
  });

  const studentName = profile.student?.user?.fullName ?? "your student";
  const actor = await actorName(ctx.userId);
  if (profile.preparedBy !== ctx.userId) {
    void fanoutNotification({
      userId: profile.preparedBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} returned the ADM case for ${studentName} for revision.`,
      sourceId: profile.referralId,
    });
  }

  void fanoutToRole("adm_coordinator", {
    sourceTable: "referrals",
    action: "status",
    message: `ADM case returned by the Principal for revision.`,
    sourceId: profile.referralId,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} returned the ADM case for ${studentName} for revision — sent to you, ${r.fullName}.`,
  });
  return updated;
}
