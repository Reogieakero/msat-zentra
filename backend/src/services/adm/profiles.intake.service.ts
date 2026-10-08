import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName, ensureAdmForm } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

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

  if (referral.referredToRole !== "adm_coordinator") {
    throw new AppError(400, "NOT_ADM_REFERRAL", "Only referrals directed to the ADM Coordinator can become ADM cases");
  }
  let studentId = input.studentId;
  let provisioned = false;
  if (studentId) {

    if (referral.student?.userId !== studentId) {
      throw new AppError(400, "STUDENT_MISMATCH", "Student account does not match this referral");
    }
  } else if (referral.student?.userId) {
    studentId = referral.student.userId;
  } else if (referral.roster) {

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

        stage: "meeting_parents",

        eligibilityStatus: "eligible",
        preparedBy: me,
      },
    });

    await tx.admParentMeeting.updateMany({
      where: { referralId: referral.id },
      data: { admLearnerProfileId: created.id, referralId: null },
    });

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
