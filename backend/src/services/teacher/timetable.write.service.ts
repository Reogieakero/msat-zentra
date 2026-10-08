import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { cleanupOrphanAssignment, notifyMastersScheduleChanged, requireMasterTeacher, resolveScheduleTarget } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface WriteEntryInput {
  sectionId: string;
  subjectId: string;
  teacherNameId: string;
  day: number;
  period: number;
}

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

  const { entry, status, prevSubjectId } = await prisma.$transaction(async (tx) => {

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

  if (!existing) {
    row = await tx.sectionTimetableEntry.create({
      data: { ...slot, subjectId, teacherNameId, status: "DRAFT" },
    });
    code = 201;
  } else if (existing.subjectId !== subjectId || existing.teacherNameId !== teacherNameId) {

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
