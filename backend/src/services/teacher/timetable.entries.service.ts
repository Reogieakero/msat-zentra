import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { cleanupOrphanAssignment, findSubjectTeacherSplits, notifyMastersScheduleChanged, requireMasterTeacher, resolveScheduleTarget } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

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

  void fanoutToRole("principal", {
    sourceTable: "section_timetable_entries",
    action: "submit",
    sourceId: sectionId ?? termId,
    excludeUserId: teacherId,
    message: sectionName
      ? `Master Teacher sent ${updated.count} timetable slots for ${sectionName} — review pending.`
      : `Master Teacher sent ${updated.count} timetable slots workspace-wide — review pending.`,
  });

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

export async function clearAll(ctx: TeacherContext) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "clear timetables");
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }

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
