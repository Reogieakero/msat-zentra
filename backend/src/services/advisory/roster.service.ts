import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { clearArchivedLearnerCache } from "../../lib/learnerVisibility.js";
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
  /** Transferees are rated from the enlistment date, not the term start. */
  learnerType?: "regular" | "transferee";
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
      enlistedTermId: ctx.termId ?? null,
      learnerType: input.learnerType ?? "regular",
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
    learnerType: entry.learnerType,
    admExempt: false,
  };
  // Cache bust on the response path: the desk refetches the roster the moment
  // this call settles, so the list read must not hit the pre-enlist cache entry.
  // Audit + notification stay in the background so the desk does not wait.
  await invalidateTags(ADVISORY_CACHE_TAGS);
  void (async () => {
    try {
      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "student_roster",
        sourceId: entry.id,
        reason: `Enlisted ${entry.fullName} (${entry.lrn}) to ${entry.section.name}`,
      });

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

export interface ArchivedAdvisee {
  archiveId: string;
  /** Same id shape the roster uses: `roster:<id>` for roster-only learners. */
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  archivedAt: string;
  hasAccount: boolean;
}

/**
 * Adviser-scoped soft delete. Only an `AdviserArchivedStudent` row is written:
 * grades, attendance, anecdotal records and referrals stay untouched, so a
 * restore brings the learner's full history back.
 */
export async function archiveAdvisoryStudent(
  ctx: AdvisoryContext,
  studentId: string,
  yearId: string | null,
) {
  const teacherId = ctx.userId;
  if (!yearId) {
    throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");
  }
  const sections = await adviserSectionsOr404(teacherId, yearId);
  const sectionIds = sections.map((s) => s.id);

  const isRoster = studentId.startsWith("roster:");
  let name = "";
  let lrn = "";
  let sectionName = "";
  let rosterId: string | null = null;
  let profileId: string | null = null;

  if (isRoster) {
    rosterId = studentId.slice("roster:".length);
    const entry = await prisma.studentRoster.findUnique({
      where: { id: rosterId },
      include: { section: { select: { name: true } } },
    });
    if (!entry || !sectionIds.includes(entry.sectionId)) {
      throw new AppError(404, "ADVISEE_NOT_FOUND", "This student is not in your advisory");
    }
    name = entry.fullName;
    lrn = entry.lrn;
    sectionName = entry.section.name;
  } else {
    profileId = studentId;
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        sectionId: true,
        lrn: true,
        section: { select: { name: true } },
        user: { select: { fullName: true } },
      },
    });
    if (!profile || !profile.sectionId || !sectionIds.includes(profile.sectionId)) {
      throw new AppError(404, "ADVISEE_NOT_FOUND", "This student is not in your advisory");
    }
    name = profile.user.fullName;
    lrn = profile.lrn;
    sectionName = profile.section?.name ?? "";
  }

  const existing = await prisma.adviserArchivedStudent.findFirst({
    where: { teacherId, ...(rosterId ? { rosterId } : { studentId: profileId! }) },
    select: { id: true },
  });
  if (!existing) {
    await prisma.adviserArchivedStudent.create({
      data: {
        teacherId,
        ...(rosterId ? { rosterId } : { studentId: profileId! }),
      },
    });
  }
  clearArchivedLearnerCache();

  // Cache bust happens on the response path (it is what makes the list read
  // fresh); only the tag this desk reads is awaited, the wider bust and the
  // audit/notification run in the background so the desk does not wait.
  await invalidateTags(["teacher"]);
  void afterRosterArchiveWrite(
    teacherId,
    rosterId ?? profileId!,
    `Removed ${name} (${lrn}) from ${sectionName || "the advisory list"} (soft delete — restorable)`,
    "create_self",
    `You removed ${name} (${lrn}) from ${sectionName || "your advisory list"}. You can restore them any time.`,
  );

  return { studentId, archived: true, name, lrn, section: sectionName };
}

/** Learners this adviser hid from the advisory list, newest first. */
export async function listArchivedAdvisoryStudents(
  ctx: AdvisoryContext,
  yearId: string | null,
): Promise<{ students: ArchivedAdvisee[] }> {
  const rows = await prisma.adviserArchivedStudent.findMany({
    where: { teacherId: ctx.userId },
    orderBy: { createdAt: "desc" },
  });

  const rosterIds = rows.map((r) => r.rosterId).filter((id): id is string => !!id);
  const profileIds = rows.map((r) => r.studentId).filter((id): id is string => !!id);

  const [rosterRows, profileRows] = await Promise.all([
    rosterIds.length > 0
      ? prisma.studentRoster.findMany({
          where: {
            id: { in: rosterIds },
            ...(yearId ? { schoolYearId: yearId } : {}),
          },
          select: {
            id: true,
            fullName: true,
            lrn: true,
            section: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    profileIds.length > 0
      ? prisma.studentProfile.findMany({
          where: { userId: { in: profileIds } },
          select: {
            userId: true,
            lrn: true,
            section: { select: { name: true } },
            user: { select: { fullName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const rosterById = new Map(rosterRows.map((r) => [r.id, r]));
  const profileById = new Map(profileRows.map((p) => [p.userId, p]));

  const students: ArchivedAdvisee[] = [];
  for (const row of rows) {
    if (row.rosterId) {
      const entry = rosterById.get(row.rosterId);
      // Archives from another school year stay in the DB but are not shown.
      if (!entry) continue;
      students.push({
        archiveId: row.id,
        studentId: `roster:${entry.id}`,
        name: entry.fullName,
        lrn: entry.lrn,
        section: entry.section.name,
        archivedAt: row.createdAt.toISOString(),
        hasAccount: false,
      });
      continue;
    }
    const profile = row.studentId ? profileById.get(row.studentId) : undefined;
    if (!profile) continue;
    students.push({
      archiveId: row.id,
      studentId: profile.userId,
      name: profile.user.fullName,
      lrn: profile.lrn,
      section: profile.section?.name ?? "",
      archivedAt: row.createdAt.toISOString(),
      hasAccount: true,
    });
  }

  return { students };
}

/** Restore: drop the archive row only — the learner's records were never touched. */
export async function restoreAdvisoryStudent(teacherId: string, archiveId: string) {
  const row = await prisma.adviserArchivedStudent.findUnique({
    where: { id: archiveId },
    select: { id: true, teacherId: true },
  });
  if (!row || row.teacherId !== teacherId) {
    throw new AppError(404, "ARCHIVE_NOT_FOUND", "This removed student is not in your list");
  }
  await prisma.adviserArchivedStudent.delete({ where: { id: row.id } });
  clearArchivedLearnerCache();
  await invalidateTags(["teacher"]);
  void afterRosterArchiveWrite(
    teacherId,
    archiveId,
    "Restored a removed student to the advisory list",
    "delete_self",
    "You restored a student to your advisory list.",
  );
  return { archiveId, restored: true };
}

/** Cache tags a roster archive/restore can make stale for every desk. */
const ADVISORY_CACHE_TAGS = [
  "registrar",
  "record-keeper",
  "academics",
  "overview",
  "principal",
  "teacher",
];

/** Background audit, wider cache bust and self-notification tail for roster archive/restore writes. */
async function afterRosterArchiveWrite(
  teacherId: string,
  sourceId: string,
  reason: string,
  action: "create_self" | "delete_self",
  notification: string,
) {
  try {
    await invalidateTags(ADVISORY_CACHE_TAGS);
    await writeAudit({
      userId: teacherId,
      actionType: "update",
      sourceTable: "student_roster",
      sourceId,
      reason,
    });
    await fanoutNotification({
      userId: teacherId,
      sourceTable: "adviser_archived_students",
      action,
      message: notification,
      sourceId,
    });
  } catch {
    /* best-effort side effects */
  }
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
    select: {
      studentId: true,
      rosterId: true,
      status: true,
      subjectId: true,
      slot: true,
      recordedBy: true,
    },
  });
  // A meetup belongs to the teacher who submitted it. Surface the owner so the
  // sheet can go read-only for anyone else (the API also refuses overwrites).
  const owners = Array.from(
    new Set(records.map((r) => r.recordedBy).filter((id) => id !== "system:auto-absent")),
  );
  const foreignOwners = owners.filter((id) => id !== teacherId);
  const ownerRows =
    foreignOwners.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: foreignOwners } },
          select: { id: true, fullName: true },
        })
      : [];
  const ownerName = new Map(ownerRows.map((u) => [u.id, u.fullName]));
  return {
    date: dayKey,
    ...(subjectId ? { subjectId, slot } : { session }),
    marks: records.map((r) => ({
      studentId: r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string),
      status: r.status,
    })),
    mine: foreignOwners.length === 0,
    submittedBy: foreignOwners.length > 0
      ? { userId: foreignOwners[0]!, name: ownerName.get(foreignOwners[0]!) ?? "another teacher" }
      : null,
  };
}
