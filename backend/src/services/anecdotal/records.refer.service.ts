import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { actorName } from "../../modules/anecdotal/anecdotal.repository.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export interface ReferInput {
  referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal";
  reason: string;
  consultReviewer?: "nurse" | "guidance_counselor" | "lrpc";
}

export async function referRecord(
  ctx: AnecdotalContext,
  recordId: string,
  input: ReferInput,
  termId: string | null,
) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      studentId: true,
      rosterId: true,
      sectionId: true,
      student: { select: { sectionId: true } },
      roster: { select: { sectionId: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  // A teacher's advisory scope wins over the JWT role: advisory sections are
  // claimed in settings, so the role can still read `subject_teacher`.
  const advised = await prisma.section.findMany({
    where: { adviserId: ctx.userId },
    select: { id: true },
  });
  if (advised.length > 0) {
    // The advisory desk can only refer its own advisees. Resolve the learner's
    // section rather than the record's, so a subject class the teacher happens
    // to handle outside their advisory cannot be referred from here.
    const advisedIds = new Set(advised.map((s) => s.id));
    const studentSectionId =
      record.student?.sectionId ?? record.roster?.sectionId ?? null;
    if (!studentSectionId || !advisedIds.has(studentSectionId)) {
      throw new AppError(403, "FORBIDDEN", "Advisers can only refer their own advisees");
    }
  } else {
    const section = await prisma.section.findUnique({
      where: { id: record.sectionId },
      select: { adviserId: true, teacherAssignments: { select: { teacherId: true } } },
    });
    const isAdviser = section?.adviserId === ctx.userId;
    const isSubjectTeacher = section?.teacherAssignments.some((a) => a.teacherId === ctx.userId);
    if (!isAdviser && !isSubjectTeacher) {
      throw new AppError(403, "FORBIDDEN", "Only the observer or a teacher in this section may refer from this record");
    }
  }
  if (!termId) {
    throw new AppError(409, "NO_ACTIVE_TERM", "No active term");
  }
  if (input.consultReviewer && input.referredToRole !== "adm_coordinator") {
    throw new AppError(400, "INVALID_ACTION", "A consultation reviewer can only be picked for ADM cases");
  }

  if (input.referredToRole === "adm_coordinator") {
    const studentMatch = record.studentId
      ? { studentId: record.studentId }
      : { rosterId: record.rosterId };
    const existingAdm = await prisma.referral.findFirst({
      where: {
        referredToRole: "adm_coordinator",
        status: { notIn: ["dismissed", "resolved"] },
        termId,
        ...studentMatch,
      },
      select: { id: true },
    });
    if (existingAdm) {
      throw new AppError(409, "ADM_CASE_EXISTS", "This student already has an open ADM case — only one ADM referral per student");
    }
  }

  const referral = await prisma.referral.create({
    data: { anecdotalRecordId: record.id, referredToRole: input.referredToRole, referredBy: ctx.userId, reason: input.reason, studentId: record.studentId, rosterId: record.rosterId, termId, consultReviewer: input.consultReviewer ?? null },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Referred to ${input.referredToRole}${input.consultReviewer ? ` (consult reviewer: ${input.consultReviewer})` : ""}` });

  const [filedAccount, filedRoster, filedSection] = await Promise.all([
    record.studentId
      ? prisma.user.findUnique({
          where: { id: record.studentId },
          select: { fullName: true },
        })
      : null,
    record.rosterId
      ? prisma.studentRoster.findUnique({
          where: { id: record.rosterId },
          select: { fullName: true },
        })
      : null,
    prisma.section.findUnique({
      where: { id: record.sectionId },
      select: { name: true },
    }),
  ]);
  const filedName =
    filedAccount?.fullName ?? filedRoster?.fullName ?? "the student";
  const filedWho = filedSection?.name
    ? `${filedName} (${filedSection.name})`
    : filedName;
  {
    const actorId = ctx.userId;
    const referralId = (referral as { id: string }).id;
    const role = input.referredToRole as
      | "nurse"
      | "guidance_counselor"
      | "adm_coordinator"
      | "principal";
    const actor = await actorName(ctx.userId);
    // Notification text deliberately omits the referral reason: the bell is a
    // low-scrutiny surface and the reason can carry health/behavioral detail.
    // The full reason stays on the referral record the recipient opens.
    const roleMessage: Record<typeof role, string> = {
      adm_coordinator: `${actor} referred ${filedWho} to ADM${input.consultReviewer ? ` (consult: ${input.consultReviewer})` : ""}.`,
      nurse: `${actor} referred ${filedWho} to the clinic.`,
      guidance_counselor: `${actor} referred ${filedWho} to guidance.`,
      principal: `${actor} referred ${filedWho} to the principal.`,
    };

    const reviewerOwned =
      role === "adm_coordinator" &&
      (input.consultReviewer === "nurse" ||
        input.consultReviewer === "guidance_counselor");
    if (!reviewerOwned) {
      void fanoutToRole(role, {
        sourceTable: "referrals",
        action: "status",
        message: roleMessage[role],
        sourceId: referralId,
        excludeUserId: actorId,
        messageFor: (r) =>
          `${actor} referred ${filedWho} to you, ${r.fullName}${input.consultReviewer ? ` (consult: ${input.consultReviewer})` : ""}.`,
      });
    }

    if (
      role === "adm_coordinator" &&
      (input.consultReviewer === "nurse" ||
        input.consultReviewer === "guidance_counselor")
    ) {
      void fanoutToRole(input.consultReviewer, {
        sourceTable: "referrals",
        action: "status",
        message: `New ADM referral needs consultation review — ${filedWho}.`,
        sourceId: referralId,
        excludeUserId: actorId,
        messageFor: (r) =>
          `${actor} referred ${filedWho} to ADM and picked you, ${r.fullName}, for consultation review.`,
      });
    }

    const roleLabel: Record<typeof role, string> = {
      adm_coordinator: "ADM Coordinator",
      nurse: "Nurse",
      guidance_counselor: "Guidance Counselor",
      principal: "Principal",
    };
    // Awaited (not fire-and-forget like the desk fanouts): the filing
    // teacher's bell refetches the moment the 201 lands, so this row must
    // already be committed or the bump is missed until the next poll.
    await fanoutNotification({
      userId: actorId,
      sourceTable: "referrals",
      action: "status",
      message: `Your referral to the ${roleLabel[role]} for ${filedWho} was submitted.`,
      sourceId: referralId,
    });
  }
  return referral;
}
