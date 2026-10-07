import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import {
  canTransition,
  evaluateAdmEligibility,
  type AdmStage,
} from "../adm.js";
import {
  actorName,
  ensureAdmForm,
  GRADE_LABEL,
} from "../../modules/adm/adm.repository.js";
import { meetingInviteeInclude, meetingInviteeList, formatMeetingAttachment } from "../../modules/adm/adm.repository.js";
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

export interface CreateProfileInput {
  studentId?: string;
  referralId: string;
  termId: string;
  certificationDetails?: Record<string, unknown>;
}

export async function createProfile(ctx: AdmContext, input: CreateProfileInput) {
  const referral = await prisma.referral.findUnique({
    where: { id: input.referralId },
    include: {
      student: { select: { userId: true, user: { select: { fullName: true } } } },
      roster: {
        select: { lrn: true, fullName: true, gradeLevel: true, sectionId: true },
      },
    },
  });
  if (!referral) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral required for ADM profile");
  // Only referrals directed to the ADM Coordinator may become ADM cases —
  // a referral filed to any other desk must never surface on this queue.
  if (referral.referredToRole !== "adm_coordinator") {
    throw new AppError(400, "NOT_ADM_REFERRAL", "Only referrals directed to the ADM Coordinator can become ADM cases");
  }
  let studentId = input.studentId;
  let provisioned = false;
  if (studentId) {
    // An explicitly passed account must belong to this referral.
    if (referral.student?.userId !== studentId) {
      throw new AppError(400, "STUDENT_MISMATCH", "Student account does not match this referral");
    }
  } else if (referral.student?.userId) {
    studentId = referral.student.userId;
  } else if (referral.roster) {
    // Roster enlistment with no account yet: reuse an existing profile
    // for the LRN (provisioned before, or approved since), else
    // auto-provision a placeholder account + profile from the roster so
    // the ADM case is never blocked on signup.
    const roster = referral.roster;
    const existing = await prisma.studentProfile.findUnique({
      where: { lrn: roster.lrn },
      select: { userId: true },
    });
    if (existing) {
      studentId = existing.userId;
    } else {
      const email = `${roster.lrn}@adm-provisioned.local`;
      const stray = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      let userId: string;
      if (stray) {
        userId = stray.id;
      } else {
        // Unusable random secret — the placeholder can never log in.
        // When the learner later self-registers, approval adopts this
        // record instead of creating a duplicate (see auth approve).
        const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            role: "student",
            fullName: roster.fullName,
            lrn: roster.lrn,
          },
        });
        userId = user.id;
      }
      await prisma.studentProfile.create({
        data: {
          userId,
          lrn: roster.lrn,
          gradeLevel: roster.gradeLevel,
          sectionId: roster.sectionId,
        },
      });
      studentId = userId;
      provisioned = true;
    }
  } else {
    throw new AppError(400, "NO_STUDENT", "Referral has neither an account nor a roster enlistment");
  }
  // Atomic unit: profile + meeting transfer + evidence forms succeed
  // together or roll back together — a half-created case (profile with
  // no forms, or transferred meetings with no profile) must never
  // persist. No external I/O inside: provisioning + argon2 stay above.
  // Profiles are always filed under the session's active term.
  const me = ctx.userId;
  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.admLearnerProfile.create({
      data: {
        studentId: studentId as string,
        referralId: referral.id,
        termId: input.termId,
        ...(input.certificationDetails !== undefined
          ? { certificationDetails: input.certificationDetails as Prisma.InputJsonValue }
          : {}),
        // A profile is always born from a referral, i.e. past
        // consultation — it starts at the parent-meeting stage (never the
        // schema-default anecdotal) so the case stays on the referrals
        // list and only its status evolves from here.
        stage: "meeting_parents",
        // Creating the profile IS the coordinator's eligibility call —
        // the case leaves "For Review" the moment it is accepted. (The
        // certification step re-derives this from the evidence chain, so
        // the principal gate always reads a computed value.)
        eligibilityStatus: "eligible",
        preparedBy: me,
      },
    });
    // Carry over any pre-profile referral bookings (scheduled with no
    // account) so the meeting history stays on the case file.
    await tx.admParentMeeting.updateMany({
      where: { referralId: referral.id },
      data: { admLearnerProfileId: created.id, referralId: null },
    });
    // Materialize the evidence chain from records that provably exist —
    // the referral itself, its anecdotal write-up, and any already
    // attended pre-profile meeting.
    await ensureAdmForm(created.id, "REFERRAL_FORM", "Referral form", me, tx);
    if (referral.anecdotalRecordId) {
      await ensureAdmForm(created.id, "ANECDOTAL_REPORT", "Anecdotal report", me, tx);
    }
    const attendedCount = await tx.admParentMeeting.count({
      where: { admLearnerProfileId: created.id, attended: true },
    });
    if (attendedCount > 0) {
      await ensureAdmForm(created.id, "MINUTES_OF_MEETING", "Minutes of meeting", me, tx);
    }
    return created;
  });
  await writeAudit({ userId: me, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: provisioned ? "ADM learner profile created (student auto-provisioned from roster)" : "ADM learner profile created" });
  // Realtime handoff (background, off the coordinator critical path):
  // the referring adviser learns the profile exists without refreshing —
  // naming the coordinator who created it.
  // Previously this notified the coordinator themselves — never useful.
  const studentName =
    referral.student?.user?.fullName ??
    referral.roster?.fullName ??
    "your student";
  const actor = await actorName(me);
  if (referral.referredBy !== me) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} created the learner profile for ${studentName} — now waiting for endorsement to the Principal.`,
      sourceId: referral.id,
    });
  }
  // Every coordinator desk learns a new case exists (all-transactions rule).
  void fanoutToRole("adm_coordinator", {
    sourceTable: "referrals",
    action: "status",
    message: `Learner profile created — now waiting for endorsement to the Principal.`,
    sourceId: referral.id,
    excludeUserId: me,
    messageFor: (r) =>
      `${actor} created the learner profile for ${studentName} — sent to you, ${r.fullName}; now waiting for endorsement to the Principal.`,
  });
  return { profile, provisioned };
}

export async function advanceStage(ctx: AdmContext, profileId: string, target: AdmStage) {
  // Single read: the eligibility recompute below needs forms +
  // meetings, so fetch them here instead of a second findUnique.
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
  // Eligibility is derived from the documented evidence chain. Recompute it
  // whenever a case enters (or passes) the certification stage so the
  // Reports/ADM eligibility buckets stay accurate without manual tagging.
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
    // Moving back before certification resets eligibility to pending.
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
  // Realtime handoff (background, off the critical path): the referring
  // adviser learns the case moved without refreshing — naming the actor.
  // Best-effort — never delays the response.
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
  // Coordinator desk tracks every stage move (all-transactions rule),
  // including moves the acting coordinator performed themselves.
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
  // Self-receipt to the actor — "You …" form; echo toast suppressed
  // client-side via markSelfNotified, bell row still lands.
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

// The ADM Coordinator's recommendation + certification, filled up right
// after the parent meeting is attended: records the recommendation and
// passes the case straight to the Principal for signature in one click.
// Accepts any pre-certification stage — early referral bookings often
// leave the stage column lagging behind the attended meeting — but always
// requires an attended parent meeting (no home-visitation path needed).
// Eligibility recomputes from the evidence chain exactly like the stage
// route, so the principal gate always reads a computed value.
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
  // Final evidence sync so the chain, the page, and eligibility agree:
  // every row below is provable from a source record on this case.
  const me = ctx.userId;
  await ensureAdmForm(profile.id, "REFERRAL_FORM", "Referral form", me);
  if (profile.referral?.anecdotalRecordId) {
    await ensureAdmForm(profile.id, "ANECDOTAL_REPORT", "Anecdotal report", me);
  }
  await ensureAdmForm(profile.id, "MINUTES_OF_MEETING", "Minutes of meeting", me);
  if ((profile.referral?.homeVisitations?.length ?? 0) > 0) {
    await ensureAdmForm(profile.id, "HV_FORM", "Home visitation form", me);
  }
  await ensureAdmForm(profile.id, "CERTIFICATION", "ADM certification", me);
  const forms = await prisma.admForm.findMany({
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
  const updated = await prisma.admLearnerProfile.update({
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
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_learner_profiles",
    sourceId: profile.id,
    reason: "ADM certification created and endorsed to Principal",
    oldValue: { stage: profile.stage },
    newValue: { stage: "principal_approval" },
  });
  // Realtime handoff (background, off the critical path): the referring
  // adviser learns the case was certified without refreshing — naming
  // the certifying coordinator.
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
  // The referring adviser learns the case was signed without refreshing —
  // naming the signing principal.
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
  // The coordinator desk learns the approval (all-transactions rule).
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
  // Returned cases go back to the coordinator who prepared them — notify
  // them (previously this notified the principal themselves). Background,
  // off the critical path — naming the returning principal.
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
  // Other coordinators on the desk see the return too (dedup suppresses
  // a second row for preparedBy when they are the only coordinator).
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

// Dedicated case file for the coordinator's "Open case" new-tab page.
// Accepts either a learner-profile id or a `referral:<id>` row id (early
// referrals without a profile yet). Returns the student header, the
// adviser's anecdotal write-up + recommendations, the GCForm-03 referral
// form state, the ADM evidence chain (forms), and parent meetings —
// everything the new-tab page renders without extra round-trips.
export async function getCaseFile(id: string) {
  const raw = id;
  const referralPrefix = "referral:";
  const asReferralId = raw.startsWith(referralPrefix)
    ? raw.slice(referralPrefix.length)
    : null;

  let profile: {
    id: string;
    stage: string;
    eligibilityStatus: string;
    referralId: string;
    createdAt: Date;
    approvedAt: Date | null;
    certificationDetails: unknown;
    student: {
      lrn: string;
      gradeLevel: string;
      user: { fullName: string };
    };
    preparedByUser: { fullName: string };
    approvedByUser: { fullName: string } | null;
    forms: {
      id: string;
      formType: string;
      title: string;
      status: string;
      notes: string | null;
      uploadedAt: Date | null;
    }[];
  } | null = null;
  let referralId: string | null = asReferralId;

  if (!referralId) {
    profile = await prisma.admLearnerProfile.findUnique({
      where: { id: raw },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        preparedByUser: { select: { fullName: true } },
        approvedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (profile) {
      referralId = profile.referralId;
    } else {
      // Fall back to a bare referral id (no `referral:` prefix).
      const direct = await prisma.referral.findUnique({
        where: { id: raw },
        select: { id: true },
      });
      if (!direct) throw new AppError(404, "NOT_FOUND", "ADM case not found");
      referralId = direct.id;
    }
  }

  const referral = referralId
    ? await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          anecdotalRecord: {
            include: {
              observer: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          referredByUser: { select: { fullName: true } },
          student: {
            select: {
              lrn: true,
              gradeLevel: true,
              user: { select: { fullName: true } },
            },
          },
          roster: {
            select: { lrn: true, fullName: true, gradeLevel: true },
          },
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
            },
          },
        },
      })
    : null;
  if (referralId && !referral) {
    throw new AppError(404, "NOT_FOUND", "ADM case not found");
  }

  // Profile may not exist yet for early referral rows — resolve it by
  // referral when the caller passed `referral:<id>`.
  if (!profile && referralId) {
    const linked = await prisma.admLearnerProfile.findFirst({
      where: { referralId },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        preparedByUser: { select: { fullName: true } },
        approvedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (linked) profile = linked;
  }

  const meetings = profile
    ? await prisma.admParentMeeting.findMany({
        where: { admLearnerProfileId: profile.id },
        include: {
          recorder: { select: { fullName: true } },
          ...meetingInviteeInclude,
          attachments: {
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: "asc" },
          },
        },
        orderBy: { meetingDatetime: "asc" },
      })
    : referralId
      ? await prisma.admParentMeeting.findMany({
          where: { referralId },
          include: {
            recorder: { select: { fullName: true } },
            ...meetingInviteeInclude,
            attachments: {
              select: {
                id: true,
                fileUrl: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                uploadedAt: true,
              },
              orderBy: { uploadedAt: "asc" },
            },
          },
          orderBy: { meetingDatetime: "asc" },
        })
      : [];

  const anecdotal = referral?.anecdotalRecord ?? null;
  const studentName =
    profile?.student.user.fullName ??
    referral?.student?.user.fullName ??
    referral?.roster?.fullName ??
    "";
  const lrn =
    profile?.student.lrn ?? referral?.student?.lrn ?? referral?.roster?.lrn ?? "";
  const gradeRaw =
    profile?.student.gradeLevel ??
    referral?.student?.gradeLevel ??
    referral?.roster?.gradeLevel ??
    "";
  const rowId = profile ? profile.id : `referral:${referralId}`;

  return {
    id: rowId,
    kind: profile ? ("profile" as const) : ("referral" as const),
    profileId: profile?.id ?? null,
    referralId,
    student: studentName,
    lrn,
    grade: GRADE_LABEL[gradeRaw] ?? gradeRaw,
    stage: profile?.stage ?? "consultation",
    eligibilityStatus: profile?.eligibilityStatus ?? "pending",
    preparedBy:
      profile?.preparedByUser.fullName ?? referral?.referredByUser.fullName ?? "",
    datePrepared: profile
      ? profile.createdAt.toISOString().slice(0, 10)
      : (anecdotal ? anecdotal.observationDatetime.toISOString().slice(0, 10) : null),
    approvedBy: profile?.approvedByUser?.fullName ?? null,
    approvalDate: profile?.approvedAt
      ? profile.approvedAt.toISOString().slice(0, 10)
      : null,
    certificationDetails: profile?.certificationDetails ?? null,
    referral: referral
      ? {
          id: referral.id,
          reason: referral.reason,
          status: referral.status,
          consultReviewer: referral.consultReviewer,
          referralFormReady: referral.referralFormReady,
          notes: referral.notes,
          priority: referral.priority,
          intakeNotes: referral.intakeNotes,
          resolutionSummary: referral.resolutionSummary,
          referredBy: referral.referredByUser.fullName,
        }
      : null,
    anecdotal: anecdotal
      ? {
          id: anecdotal.id,
          observationDatetime: anecdotal.observationDatetime.toISOString(),
          observationDate: anecdotal.observationDatetime.toISOString().slice(0, 10),
          category: anecdotal.category,
          confidentialityLevel: anecdotal.confidentialityLevel,
          descriptionOfIncident: anecdotal.descriptionOfIncident,
          descriptionOfLocation: anecdotal.descriptionOfLocation,
          // Adviser recommendations / actions — the "recommendations"
          // block on the dedicated page.
          recommendations: anecdotal.notesRecommendationsActions,
          classPerformance: anecdotal.classPerformance,
          attendanceSummary: anecdotal.attendanceSummary,
          observer: anecdotal.observer.fullName,
          section: anecdotal.section.name,
        }
      : null,
    // GCForm-03 (referral form) state — completed on the nurse
    // referral-form page; the coordinator page surfaces readiness plus
    // the stored endorsement/recommendation note.
    gcForm03: referral
      ? { ready: referral.referralFormReady }
      : null,
    forms: (profile?.forms ?? []).map((f) => ({
      id: f.id,
      formType: f.formType,
      title: f.title,
      status: f.status,
      notes: f.notes,
      uploadedAt: f.uploadedAt ? f.uploadedAt.toISOString() : null,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      meetingDatetime: m.meetingDatetime.toISOString(),
      venue: m.venue,
      attended: m.attended,
      parentConfirmedAt: m.parentConfirmedAt ? m.parentConfirmedAt.toISOString() : null,
      minutesOfMeeting: m.minutesOfMeeting,
      attendanceLogbookRef: m.attendanceLogbookRef,
      attendees: m.attendees ?? [],
      invitees: meetingInviteeList(m),
      attachments: m.attachments.map(formatMeetingAttachment),
      recordedBy: m.recorder.fullName,
    })),
    sessions: (referral?.counselingSessions ?? []).map((s) => ({
      id: s.id,
      sessionType: s.sessionType,
      scheduledAt: s.scheduledAt.toISOString(),
      venue: s.venue,
      status: s.status,
      sessionNotes: s.sessionNotes,
      outcome: s.outcome,
    })),
  };
}
