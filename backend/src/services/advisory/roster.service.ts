import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { mascotForUnique, sectionTakenMascots } from "../mascot.js";
import {
  adviserSectionsOr404,
  teachableSectionIds,
} from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "./advisory.types.js";

export interface EnlistInput {
  fullName: string;
  lrn: string;
  sectionId?: string;
}

/** Marker email domain for placeholder accounts auto-created by SF10 upload. */
const SF10_PROVISIONED_SUFFIX = "@sf10-provisioned.local";

/**
 * Pure helper (unit-tested): an SF10 upload auto-provisions a placeholder
 * account (`<lrn>@sf10-provisioned.local`) so the LRN exists before any
 * real enrollment. That placeholder must NOT gate advisory enlistment —
 * the advisory list is ungated, so a provisioned LRN enlists like roster-only.
 */
export function isSf10ProvisionedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(SF10_PROVISIONED_SUFFIX);
}

export async function enlistRoster(
  ctx: AdvisoryContext,
  input: EnlistInput,
  yearId: string | null,
) {
  const teacherId = ctx.userId;

  if (!yearId) {
    throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
  }
  const sections = await adviserSectionsOr404(teacherId, yearId);
  const section = input.sectionId
    ? sections.find((s) => s.id === input.sectionId)
    : sections[0];
  if (!section) {
    throw new AppError(404, "SECTION_NOT_FOUND", "Section is not in your advisory");
  }

  const existing = await prisma.studentRoster.findUnique({
    where: { lrn_schoolYearId: { lrn: input.lrn, schoolYearId: yearId } },
  });
  if (existing) {
    throw new AppError(409, "LRN_ENLISTED", "This LRN is already enlisted");
  }
  const alreadyRegistered = await prisma.studentProfile.findUnique({
    where: { lrn: input.lrn },
    select: { userId: true, user: { select: { email: true } } },
  });
  // The advisory list is ungated: an LRN saved only as an SF10-upload
  // placeholder account is not a real enrollment, so it never blocks
  // enlistment. Only a real (non-provisioned) account does.
  if (alreadyRegistered && !isSf10ProvisionedEmail(alreadyRegistered.user.email)) {
    throw new AppError(409, "LRN_REGISTERED", "This LRN already has an account");
  }

  const taken = await sectionTakenMascots(prisma, section.id);
  const entry = await prisma.studentRoster.create({
    data: {
      lrn: input.lrn,
      fullName: input.fullName,
      mascot: mascotForUnique(input.fullName, input.lrn, taken),
      gradeLevel: section.gradeLevel,
      sectionId: section.id,
      schoolYearId: yearId,
    },
    include: { section: { select: { name: true } } },
  });

  const response = {
    studentId: `roster:${entry.id}`,
    name: entry.fullName,
    lrn: entry.lrn,
    mascot: entry.mascot,
    birthdate: null,
    gender: null,
    section: entry.section.name,
    riskLevel: "Low",
    flags: [],
    attendanceRate: 1,
    anecdotalCount: 0,
    confidentialityTiers: [],
    hasOpenFlag: false,
    openFlagCount: 0,
    hasAccount: false,
  };
  void (async () => {
    try {
      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "student_roster",
        sourceId: entry.id,
        reason: `Enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}`,
      });

      await invalidateTags([
        "registrar",
        "record-keeper",
        "academics",
        "overview",
        "principal",
        "teacher",
      ]);

      await fanoutNotification({
        userId: teacherId,
        sourceTable: "student_roster",
        action: "create_self",
        message: `You enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}.`,
        sourceId: entry.id,
      });
    } catch {

    }
  })();
  return response;
}

export interface UpdateRosterInput {
  fullName: string;
  lrn: string;
}

/**
 * Advisory list edit: the adviser may correct a learner's name and LRN.
 * Works for both roster-only learners (`roster:<id>`) and learners who
 * already have an account (StudentProfile.lrn + User.fullName). LRN stays
 * unique across the school year and cannot steal a real account's LRN.
 */
export async function updateRosterStudent(
  ctx: AdvisoryContext,
  studentId: string,
  input: UpdateRosterInput,
  yearId: string | null,
) {
  const teacherId = ctx.userId;
  if (!yearId) {
    throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
  }
  const sections = await adviserSectionsOr404(teacherId, yearId);
  const sectionIds = sections.map((s) => s.id);

  if (studentId.startsWith("roster:")) {
    const rosterId = studentId.slice("roster:".length);
    const entry = await prisma.studentRoster.findUnique({
      where: { id: rosterId },
      include: { section: { select: { name: true } } },
    });
    if (!entry || !sectionIds.includes(entry.sectionId)) {
      throw new AppError(404, "ADVISEE_NOT_FOUND", "This student is not in your advisory");
    }
    if (entry.lrn !== input.lrn) {
      const duplicate = await prisma.studentRoster.findFirst({
        where: { lrn: input.lrn, schoolYearId: yearId, NOT: { id: entry.id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(409, "LRN_ENLISTED", "This LRN is already enlisted");
      }
      const registered = await prisma.studentProfile.findUnique({
        where: { lrn: input.lrn },
        select: { userId: true, user: { select: { email: true } } },
      });
      // SF10 placeholders are not real accounts, same rule as enlistment.
      if (registered && !isSf10ProvisionedEmail(registered.user.email)) {
        throw new AppError(409, "LRN_REGISTERED", "This LRN already has an account");
      }
    }
    const updated = await prisma.studentRoster.update({
      where: { id: entry.id },
      data: { fullName: input.fullName, lrn: input.lrn },
    });
    await afterRosterWrite(
      teacherId,
      updated.id,
      `Updated ${entry.fullName} (${entry.lrn}) → ${updated.fullName} (${updated.lrn}) in ${entry.section.name}`,
      `You updated ${updated.fullName} (${updated.lrn}) in ${entry.section.name}.`,
    );
    return {
      studentId: `roster:${updated.id}`,
      name: updated.fullName,
      lrn: updated.lrn,
    };
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      userId: true,
      lrn: true,
      sectionId: true,
      section: { select: { name: true } },
      user: { select: { fullName: true } },
    },
  });
  if (!profile || !profile.sectionId || !sectionIds.includes(profile.sectionId)) {
    throw new AppError(404, "ADVISEE_NOT_FOUND", "This student is not in your advisory");
  }
  if (profile.lrn !== input.lrn) {
    const duplicate = await prisma.studentProfile.findUnique({
      where: { lrn: input.lrn },
      select: { userId: true },
    });
    if (duplicate && duplicate.userId !== profile.userId) {
      throw new AppError(409, "LRN_REGISTERED", "This LRN already has an account");
    }
    // A roster-only learner already holding this LRN would be silently merged
    // into this account (the list de-dupes by LRN), so block it instead.
    const rosterDuplicate = await prisma.studentRoster.findUnique({
      where: { lrn_schoolYearId: { lrn: input.lrn, schoolYearId: yearId } },
      select: { id: true },
    });
    if (rosterDuplicate) {
      throw new AppError(409, "LRN_ENLISTED", "This LRN is already enlisted");
    }
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: profile.userId },
      data: { fullName: input.fullName },
    }),
    prisma.studentProfile.update({
      where: { userId: profile.userId },
      data: { lrn: input.lrn },
    }),
  ]);
  await afterRosterWrite(
    teacherId,
    profile.userId,
    `Updated ${profile.user.fullName} (${profile.lrn}) → ${input.fullName} (${input.lrn}) in ${profile.section?.name ?? "advisory"}`,
    `You updated ${input.fullName} (${input.lrn}) in ${profile.section?.name ?? "your advisory"}.`,
  );
  return { studentId: profile.userId, name: input.fullName, lrn: input.lrn };
}

/** Shared audit + cache invalidation + self-notification tail for roster writes. */
async function afterRosterWrite(
  teacherId: string,
  sourceId: string,
  auditReason: string,
  notification: string,
) {
  try {
    await writeAudit({
      userId: teacherId,
      actionType: "update",
      sourceTable: "student_roster",
      sourceId,
      reason: auditReason,
    });
    await invalidateTags([
      "registrar",
      "record-keeper",
      "academics",
      "overview",
      "principal",
      "teacher",
    ]);
    await fanoutNotification({
      userId: teacherId,
      sourceTable: "student_roster",
      action: "update_self",
      message: notification,
      sourceId,
    });
  } catch {
    /* best-effort side effects */
  }
}

export interface AttendanceSheetQuery {
  sectionId?: string;
  subjectId?: string;
  slot: number;
  session: string;
  date: Date;
  schoolYearId: string | null;
}

export async function getAttendanceSheet(ctx: AdvisoryContext, query: AttendanceSheetQuery) {
  const teacherId = ctx.userId;

  const teachable = await teachableSectionIds(
    teacherId,
    null,
    query.schoolYearId,
  );
  if (teachable.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory or teaching sections assigned");
  }
  const { sectionId: onlySection, subjectId, slot, session, date } = query;
  if (onlySection && !teachable.includes(onlySection)) {
    throw new AppError(403, "FORBIDDEN", "Section is not in your teaching load");
  }
  const sectionIds = onlySection ? [onlySection] : teachable;
  if (!subjectId && session !== "AM" && session !== "PM") {
    throw new AppError(400, "BAD_SESSION", "session must be AM or PM");
  }
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "BAD_DATE", "date must be an ISO datetime");
  }
  const dayKey = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dayKey}T00:00:00Z`);
  const nextDay = new Date(dayStart.getTime() + 86_400_000);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      sectionId: { in: sectionIds },
      ...(subjectId
        ? { subjectId, slot }
        : { session: session as "AM" | "PM" }),
      date: { gte: dayStart, lt: nextDay },
    },
    select: { studentId: true, rosterId: true, status: true, subjectId: true, slot: true },
  });
  return {
    date: dayKey,
    ...(subjectId ? { subjectId, slot } : { session }),
    marks: records.map((r) => ({
      studentId: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      status: r.status,
    })),
  };
}
