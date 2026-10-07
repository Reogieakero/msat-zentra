import { randomInt } from "crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import {
  cleanupOrphanAssignment,
  findSubjectTeacherSplits,
  notifyMastersScheduleChanged,
  requireMasterTeacher,
  resolveScheduleTarget,
  SCHEDULE_CONFIG_DEFAULTS,
  toScheduleConfig,
} from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export async function getSchedule(ctx: TeacherContext) {
  const termId = ctx.termId;
  const yearId = ctx.schoolYearId;
  const sections = await prisma.section.findMany({
    where: {
      gradeLevel: { in: ["G7", "G8", "G9", "G10"] },
      ...(yearId ? { schoolYearId: yearId } : {}),
    },
    include: {
      adviser: { select: { fullName: true } },
      teacherAssignments: {
        where: termId ? { termId } : undefined,
        include: { subject: true, teacher: { select: { fullName: true } } },
      },
      timetableEntries: {
        where: termId ? { termId } : undefined,
        select: {
          subjectId: true,
          teacherNameId: true,
          day: true,
          period: true,
          status: true,
          reviewNote: true,
          subject: { select: { id: true, name: true, code: true } },
          teacherName: { select: { id: true, name: true } },
        },
      },
      _count: { select: { students: true } },
    },
  });
  return { sections };
}

// The signed-in teacher's own timetable slots for the active term —
// committed slots only (approved + submitted), ordered for calendar render.
export async function getMySlots(ctx: TeacherContext) {
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const slots = await prisma.sectionTimetableEntry.findMany({
    where: {
      termId,
      status: { in: ["APPROVED", "SUBMITTED"] },
      teacherName: { userId: ctx.userId },
    },
    select: {
      day: true,
      period: true,
      status: true,
      subject: { select: { id: true, name: true, code: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      teacherName: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });
  return { slots };
}

// Subject options for the scheduling overlay — grades 7–10 only, so the
// master teacher can only pick subjects that belong to a section's grade.
export async function listScheduleSubjects() {
  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: ["G7", "G8", "G9", "G10"] } },
    select: { id: true, name: true, code: true, gradeLevel: true, category: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  return { subjects };
}

// Day-shape config for the active term. No row yet → app defaults (same shape
// the setup view used before persistence existed). Principals can read it to
// render clock times on the review page; only masters may change it.
export async function getScheduleConfig(ctx: TeacherContext) {
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const row = await prisma.scheduleConfig.findUnique({ where: { termId } });
  return { config: row ? toScheduleConfig(row) : SCHEDULE_CONFIG_DEFAULTS };
}

export interface ScheduleConfigInput {
  startTime: string;
  periodMins: number;
  lunch: { afterPeriod: number; mins: number };
  morningRecess: { enabled: boolean; afterPeriod: number; mins: number };
  afternoonRecess: { enabled: boolean; afterPeriod: number; mins: number };
}

export async function updateScheduleConfig(ctx: TeacherContext, body: ScheduleConfigInput) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "configure the school day");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const row = await prisma.scheduleConfig.upsert({
    where: { termId },
    create: {
      termId,
      startTime: body.startTime,
      periodMins: body.periodMins,
      lunchAfter: body.lunch.afterPeriod,
      lunchMins: body.lunch.mins,
      recessAmOn: body.morningRecess.enabled,
      recessAmAfter: body.morningRecess.afterPeriod,
      recessAmMins: body.morningRecess.mins,
      recessPmOn: body.afternoonRecess.enabled,
      recessPmAfter: body.afternoonRecess.afterPeriod,
      recessPmMins: body.afternoonRecess.mins,
    },
    update: {
      startTime: body.startTime,
      periodMins: body.periodMins,
      lunchAfter: body.lunch.afterPeriod,
      lunchMins: body.lunch.mins,
      recessAmOn: body.morningRecess.enabled,
      recessAmAfter: body.morningRecess.afterPeriod,
      recessAmMins: body.morningRecess.mins,
      recessPmOn: body.afternoonRecess.enabled,
      recessPmAfter: body.afternoonRecess.afterPeriod,
      recessPmMins: body.afternoonRecess.mins,
    },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "schedule_configs",
    sourceId: row.id,
    reason: "Master Teacher updated the school-day schedule shape",
  });
  void notifyMastersScheduleChanged(
    "The school-day schedule shape was updated.",
    teacherId
  );
  return { config: toScheduleConfig(row) };
}

export async function assignSubject(ctx: TeacherContext, subjectId: string, sectionId: string) {
  const teacherId = ctx.userId;
  const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
  if (!profile?.isMasterTeacher) {
    throw new AppError(403, "MASTER_TEACHER_REQUIRED", "Only Master Teachers can schedule subjects");
  }
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || !["G7", "G8", "G9", "G10"].includes(section.gradeLevel as string)) {
    throw new AppError(403, "GRADE_BAND_NOT_ALLOWED", "Schedule subject is only available for grades 7–10");
  }
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  }
  if (subject.gradeLevel !== section.gradeLevel) {
    throw new AppError(403, "GRADE_MISMATCH", "The subject must belong to the section's grade level");
  }
  const existing = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, sectionId, termId },
  });
  if (existing) {
    throw new AppError(409, "ASSIGNMENT_EXISTS", "This subject is already assigned to this section");
  }
  const assignment = await prisma.teacherSubjectAssignment.create({
    data: { teacherId, subjectId, sectionId, termId },
    include: { subject: true, section: true },
  }) as { id: string; subject: { name: string }; section: { name: string } };
  await writeAudit({
    userId: teacherId,
    actionType: "create",
    sourceTable: "teacher_subject_assignments",
    sourceId: assignment.id,
    reason: `Scheduled ${assignment.subject.name} for ${assignment.section.name}`,
  });
  void notifyMastersScheduleChanged(
    `${assignment.subject.name} was scheduled for ${assignment.section.name}.`,
    teacherId
  );
  return assignment;
}

// Unlock an approved timetable for editing. Approved slots are locked
// against fills, swaps, and clears — this is the only way back to draft,
// keeping every slot's content and stopping it from being official until
// the principal approves again.
export async function unlockSection(ctx: TeacherContext, sectionId: string) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "unlock timetables");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const section = await resolveScheduleTarget(sectionId, null);
  const unlocked = await prisma.sectionTimetableEntry.updateMany({
    where: { sectionId, termId, status: "APPROVED" },
    data: {
      status: "DRAFT",
      submittedBy: null,
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
  });
  if (unlocked.count === 0) {
    throw new AppError(404, "NOTHING_LOCKED", "No approved slots to unlock for this section");
  }
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "section_timetable_entries",
    sourceId: sectionId,
    reason: `Master Teacher unlocked the approved timetable for ${section.name} (${unlocked.count} slots back to draft)`,
  });
  void notifyMastersScheduleChanged(
    `The approved timetable for ${section.name} was unlocked for editing (${unlocked.count} slots back to draft).`,
    teacherId
  );
  return { drafted: unlocked.count };
}

// Send draft slots to the principal for review. With a sectionId it sends one
// section; without it, every draft workspace-wide. Already-submitted and
// approved rows are untouched either way.
export async function submitTimetable(ctx: TeacherContext, sectionId?: string) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "send timetables for review");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  let sectionName: string | null = null;
  if (sectionId) {
    const section = await resolveScheduleTarget(sectionId, null);
    sectionName = section.name;
  }
  const scope = sectionId ? { sectionId, termId } : { termId };
  // Legacy rows saved before the one-teacher-per-subject rule (e.g.
  // Mathematics 7 held by several teachers in one section) must be
  // unified before review — submitting them would carry the split into
  // SUBMITTED/APPROVED. A teacher may still own several subjects.
  const splits = await findSubjectTeacherSplits(scope);
  if (splits.length > 0) {
    const detail = splits
      .map((s) => `${s.subjectName} in ${s.sectionName} (${s.teacherNames.join(", ")})`)
      .join("; ");
    throw new AppError(
      409,
      "SUBJECT_TEACHER_SPLIT",
      `One subject takes one teacher per section — unify before sending for review: ${detail}. Clear the subject's slots first to reassign it.`,
    );
  }
  const now = new Date();
  const updated = await prisma.sectionTimetableEntry.updateMany({
    where: { ...scope, status: "DRAFT" },
    data: {
      status: "SUBMITTED",
      submittedBy: teacherId,
      submittedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
  });
  if (updated.count === 0) {
    throw new AppError(
      400,
      "NOTHING_TO_SEND",
      sectionId ? "No draft slots to send for this section" : "No draft slots to send"
    );
  }
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "section_timetable_entries",
    sourceId: sectionId ?? termId,
    reason: sectionId
      ? `Master Teacher sent ${updated.count} timetable slots for principal review`
      : `Master Teacher sent ${updated.count} timetable slots workspace-wide for principal review`,
  });
  // Principals learn about the pending review from their bell, not from
  // a second query — best-effort, never delays this response.
  void fanoutToRole("principal", {
    sourceTable: "section_timetable_entries",
    action: "submit",
    sourceId: sectionId ?? termId,
    excludeUserId: teacherId,
    message: sectionName
      ? `Master Teacher sent ${updated.count} timetable slots for ${sectionName} — review pending.`
      : `Master Teacher sent ${updated.count} timetable slots workspace-wide — review pending.`,
  });
  // Self receipt: the submitting master's own bell keeps the row.
  void fanoutNotification({
    userId: teacherId,
    sourceTable: "section_timetable_entries",
    action: "submit",
    sourceId: sectionId ?? termId,
    message: sectionName
      ? `You sent ${updated.count} timetable slots for ${sectionName} for principal review.`
      : `You sent ${updated.count} timetable slots workspace-wide for principal review.`,
  });
  return { submitted: updated.count };
}

export interface WriteEntryInput {
  sectionId: string;
  subjectId: string;
  teacherNameId: string;
  day: number;
  period: number;
}

// Fill (or replace) one timetable slot. Idempotent for the same subject.
// The slot carries a plain catalog name for display; the derived assignment
// always belongs to the master editing the grid, so gradebook ownership
// stays with a real account.
export async function writeEntry(ctx: TeacherContext, input: WriteEntryInput) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "schedule subjects");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const { sectionId, subjectId, teacherNameId, day, period } = input;
  await resolveScheduleTarget(sectionId, subjectId);
  const teacherName = await prisma.teacherName.findUnique({ where: { id: teacherNameId } });
  if (!teacherName) {
    throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher name not found");
  }
  // Check + write run in one transaction so two concurrent fills for
  // the same subject with different teachers cannot both slip through
  // the sibling check: the post-write re-verification inside the same
  // transaction rolls back the loser with SUBJECT_TEACHER_SPLIT.
  const { entry, status, prevSubjectId } = await prisma.$transaction(async (tx) => {
  // A teacher cannot run two sections in the same time slot: any other
  // section holding this teacher at this day + period blocks the fill.
  // The section's own slot is excluded — replacing inside it is an update.
  const clash = await tx.sectionTimetableEntry.findFirst({
    where: { termId, day, period, teacherNameId, NOT: { sectionId } },
    include: {
      section: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });
  if (clash) {
    throw new AppError(
      409,
      "TEACHER_DOUBLE_BOOKED",
      `${teacherName.name} already teaches ${clash.subject.name} in ${clash.section.name} at this time`
    );
  }
  // One subject takes one teacher per section: any OTHER slot in this
  // section holding the same subject under a different teacher blocks
  // the fill. The slot being written is excluded, so retaking the
  // subject's last remaining slot still swaps its teacher cleanly.
  // To move a subject to another teacher, clear its slots first.
  // A teacher may still own several subjects in the same section.
  const siblings = await tx.sectionTimetableEntry.findMany({
    where: { sectionId, termId, subjectId },
    select: {
      day: true,
      period: true,
      teacherNameId: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
      teacherName: { select: { name: true } },
    },
  });
  const holder = siblings.find(
    (e) =>
      e.teacherNameId &&
      e.teacherNameId !== teacherNameId &&
      !(e.day === day && e.period === period),
  );
  if (holder) {
    const subjectName = holder.subject?.name ?? "This subject";
    const sectionName = holder.section?.name ?? "this section";
    const holderName = holder.teacherName?.name ?? "another teacher";
    throw new AppError(
      409,
      "SUBJECT_TEACHER_SPLIT",
      `${subjectName} in ${sectionName} is already assigned to ${holderName} — one subject takes one teacher per section. Clear its slots first to reassign it.`
    );
  }
  const slot = { sectionId, termId, day, period };
  const existing = await tx.sectionTimetableEntry.findUnique({
    where: { sectionId_termId_day_period: slot },
  });
  let row = existing;
  let code = 200;
  // Fills are always drafts — never live. Only principal approval
  // materializes gradebook assignments, so nothing is ensured here.
  // Replacing an approved slot's content sends it back for review.
  if (!existing) {
    row = await tx.sectionTimetableEntry.create({
      data: { ...slot, subjectId, teacherNameId, status: "DRAFT" },
    });
    code = 201;
  } else if (existing.subjectId !== subjectId || existing.teacherNameId !== teacherNameId) {
    // Approved timetables are locked — content swaps must go through an
    // explicit unlock (POST /schedule/unlock), never a silent demote.
    if (existing.status === "APPROVED") {
      throw new AppError(
        409,
        "SCHEDULE_LOCKED",
        "This slot is part of an approved timetable — unlock the section to edit it"
      );
    }
    row = await tx.sectionTimetableEntry.update({
      where: { id: existing.id },
      data: {
        subjectId,
        teacherNameId,
        status: "DRAFT",
        submittedBy: null,
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
  }
    // Post-write re-verification: catches the concurrent-fill race where
    // two writers both passed the pre-check before either row committed.
    const after = await tx.sectionTimetableEntry.findMany({
      where: { sectionId, termId, subjectId },
      select: { teacherNameId: true },
    });
    const distinct = new Set(after.map((e) => e.teacherNameId).filter(Boolean));
    if (distinct.size > 1) {
      throw new AppError(
        409,
        "SUBJECT_TEACHER_SPLIT",
        "One subject takes one teacher per section — another save just claimed this subject. Reload and retry."
      );
    }
    return { entry: row, status: code, prevSubjectId: existing?.subjectId ?? null };
  });
  if (prevSubjectId && prevSubjectId !== subjectId) {
    await cleanupOrphanAssignment(teacherId, prevSubjectId, sectionId, termId);
  }
  await writeAudit({
    userId: teacherId,
    actionType: status === 201 ? "create" : "update",
    sourceTable: "section_timetable_entries",
    sourceId: entry!.id,
    reason: "Master Teacher set a timetable slot",
  });
  void notifyMastersScheduleChanged("A timetable slot was set.", teacherId);
  return {
    entry: {
      id: entry!.id,
      sectionId,
      subjectId,
      teacherNameId,
      termId,
      day,
      period,
    },
    status,
  };
}

// Empty one timetable slot. Drops the requester's assignment when its last
// cell for that subject is gone.
export async function clearEntry(
  ctx: TeacherContext,
  sectionId: string,
  day: number,
  period: number,
) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "unschedule subjects");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  if (!sectionId || !Number.isInteger(day) || day < 1 || day > 5 || !Number.isInteger(period) || period < 0 || period > 7) {
    throw new AppError(400, "INVALID_SLOT", "sectionId, day (1–5) and period (0–7) are required");
  }
  const entry = await prisma.sectionTimetableEntry.findUnique({
    where: { sectionId_termId_day_period: { sectionId, termId, day, period } },
  });
  if (!entry) {
    throw new AppError(404, "NOT_FOUND", "Timetable slot is already empty");
  }
  if (entry.status === "APPROVED") {
    throw new AppError(
      409,
      "SCHEDULE_LOCKED",
      "This slot is part of an approved timetable — unlock the section to edit it"
    );
  }
  await prisma.sectionTimetableEntry.delete({ where: { id: entry.id } });
  await cleanupOrphanAssignment(teacherId, entry.subjectId, sectionId, termId);
  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "section_timetable_entries",
    sourceId: entry.id,
    reason: "Master Teacher cleared a timetable slot",
  });
  void notifyMastersScheduleChanged("A timetable slot was cleared.", teacherId);
  return { deleted: true };
}

// Clear the whole weekly grid for one section. Drops the requester's
// assignments left without cells.
export async function clearSection(ctx: TeacherContext, sectionId: string) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "clear timetables");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  if (!sectionId) {
    throw new AppError(400, "INVALID_SECTION", "sectionId is required");
  }
  await resolveScheduleTarget(sectionId, null);
  // Approved slots are locked — clears skip them (unlock first to
  // remove an approved timetable) and report what was kept.
  const lockedCount = await prisma.sectionTimetableEntry.count({
    where: { sectionId, termId, status: "APPROVED" },
  });
  const subjectIds = await prisma.sectionTimetableEntry.findMany({
    where: { sectionId, termId, status: { not: "APPROVED" } },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  const removed = await prisma.sectionTimetableEntry.deleteMany({
    where: { sectionId, termId, status: { not: "APPROVED" } },
  });
  for (const { subjectId } of subjectIds) {
    await cleanupOrphanAssignment(teacherId, subjectId, sectionId, termId);
  }
  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "section_timetable_entries",
    sourceId: sectionId,
    reason: `Master Teacher cleared the whole timetable (${removed.count} slots)`,
  });
  void notifyMastersScheduleChanged(
    `A section timetable was cleared (${removed.count} slots).`,
    teacherId
  );
  return { deleted: removed.count, skippedApproved: lockedCount };
}

// Clear every timetable cell workspace-wide for the active term. Entries only
// ever exist for grades 7–10 (validated on write), so no per-section band
// check is needed.
export async function clearAll(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "clear timetables");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  // Approved slots are locked — the workspace clear skips them and
  // reports what was kept.
  const lockedCount = await prisma.sectionTimetableEntry.count({
    where: { termId, status: "APPROVED" },
  });
  const pairs = await prisma.sectionTimetableEntry.findMany({
    where: { termId, status: { not: "APPROVED" } },
    select: { subjectId: true, sectionId: true },
    distinct: ["subjectId", "sectionId"],
  });
  const removed = await prisma.sectionTimetableEntry.deleteMany({
    where: { termId, status: { not: "APPROVED" } },
  });
  for (const p of pairs) {
    await cleanupOrphanAssignment(teacherId, p.subjectId, p.sectionId, termId);
  }
  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "section_timetable_entries",
    sourceId: termId,
    reason: `Master Teacher cleared all timetables (${removed.count} slots)`,
  });
  void notifyMastersScheduleChanged(
    `All timetables were cleared workspace-wide (${removed.count} slots).`,
    teacherId
  );
  return { deleted: removed.count, skippedApproved: lockedCount };
}

// Master-created catalog records: teacher names and subjects, created from
// the slot overlay when the needed name is missing from the lists.
export async function createTeacherName(ctx: TeacherContext, fullName: string) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "add teacher names");
  const name = fullName.trim();
  const existing = await prisma.teacherName.findUnique({ where: { name } });
  if (existing) {
    throw new AppError(409, "TEACHER_EXISTS", "This name is already listed");
  }
  // Token code from initials + digits (MS-482), retried on collision.
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "")}`
      .toUpperCase()
      .replace(/[^A-Z]/g, "") || "T";
  let code = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${initials}-${100 + randomInt(900)}`;
    const clash = await prisma.teacherName.findUnique({ where: { code: candidate } });
    if (!clash) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new AppError(500, "CODE_MINT_FAILED", "Could not mint a unique code, try again");
  }
  const teacher = await prisma.teacherName.create({
    data: { name, code },
    select: { id: true, name: true, code: true },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "create",
    sourceTable: "teacher_names",
    sourceId: teacher.id,
    reason: `Master Teacher listed teacher name ${teacher.name}`,
  });
  void notifyMastersScheduleChanged(
    `Teacher name ${teacher.name} (${teacher.code}) was added to the catalog.`,
    teacherId
  );
  return teacher;
}

// Empty the whole teacher-name catalog. Timetable cells cascade via FK; the
// requester's assignments left without cells are swept so no dead
// gradebook owners linger.
export async function clearTeacherNames(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "clear teacher names");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const pairs = await prisma.sectionTimetableEntry.findMany({
    where: { termId, teacherNameId: { not: null } },
    select: { subjectId: true, sectionId: true },
    distinct: ["subjectId", "sectionId"],
  });
  const removed = await prisma.teacherName.deleteMany({});
  for (const p of pairs) {
    const remaining = await prisma.sectionTimetableEntry.count({
      where: { sectionId: p.sectionId, termId, subjectId: p.subjectId },
    });
    if (remaining === 0) {
      await prisma.teacherSubjectAssignment.deleteMany({
        where: { subjectId: p.subjectId, sectionId: p.sectionId, termId },
      });
    }
  }
  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "teacher_names",
    sourceId: teacherId,
    reason: `Master Teacher cleared the teacher-name list (${removed.count} names)`,
  });
  void notifyMastersScheduleChanged(
    `The teacher-name catalog was cleared (${removed.count} names).`,
    teacherId
  );
  return { deleted: removed.count };
}

export interface CreateSubjectInput {
  name: string;
  code: string;
  gradeLevel: "G7" | "G8" | "G9" | "G10";
  category: "CORE" | "ELECTIVE";
}

// Subjects are usable immediately (no approval concept) and auto-selected.
export async function createSubject(ctx: TeacherContext, input: CreateSubjectInput) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "create subjects");
  const { name, code, gradeLevel, category } = input;
  const normalizedCode = code.trim().toUpperCase();
  const existing = await prisma.subject.findUnique({
    where: {
      code_gradeLevel: {
        code: normalizedCode,
        gradeLevel: gradeLevel as "G7" | "G8" | "G9" | "G10",
      },
    },
  });
  if (existing) {
    throw new AppError(409, "SUBJECT_EXISTS", "This subject code already exists for the grade");
  }
  const subject = await prisma.subject.create({
    data: { name: name.trim(), code: normalizedCode, gradeLevel, category },
    select: { id: true, name: true, code: true, gradeLevel: true, category: true },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "create",
    sourceTable: "subjects",
    sourceId: subject.id,
    reason: `Master Teacher created subject ${subject.name}`,
  });
  void notifyMastersScheduleChanged(
    `Subject ${subject.name} (${subject.code}) was added to the catalog.`,
    teacherId
  );
  return subject;
}

export async function deleteAssignment(ctx: TeacherContext, assignmentId: string) {
  const teacherId = ctx.userId;
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: assignmentId },
    include: { subject: true, section: true },
  }) as {
    id: string;
    teacherId: string;
    subjectId: string;
    sectionId: string;
    termId: string;
    subject: { name: string };
    section: { name: string };
  } | null;
  if (!assignment || assignment.teacherId !== teacherId) {
    throw new AppError(404, "NOT_FOUND", "Assignment not found");
  }
  // Term-scoped: a prior term's assignment is read-only history.
  if (ctx.termId && assignment.termId !== ctx.termId) {
    throw new AppError(404, "NOT_FOUND", "Assignment not found in the active term");
  }
  const profile = await prisma.staffProfile.findUnique({ where: { userId: teacherId } });
  if (!profile?.isMasterTeacher) {
    throw new AppError(403, "MASTER_TEACHER_REQUIRED", "Only Master Teachers can unschedule subjects");
  }
  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "teacher_subject_assignments",
    sourceId: assignment.id,
    reason: `Unschedule ${assignment.subject.name} from ${assignment.section.name}`,
  });
  await prisma.teacherSubjectAssignment.delete({ where: { id: assignmentId } });
  // Unscheduling a subject also clears its timetable cells for this term —
  // entries reference the subject directly, so they would otherwise dangle.
  await prisma.sectionTimetableEntry.deleteMany({
    where: {
      sectionId: assignment.sectionId,
      termId: assignment.termId,
      subjectId: assignment.subjectId,
    },
  });
  void notifyMastersScheduleChanged(
    `${assignment.subject.name} was unscheduled from ${assignment.section.name}.`,
    teacherId
  );
  return { deleted: true };
}
