import { randomInt } from "crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyMastersScheduleChanged, requireMasterTeacher, toScheduleConfig } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

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
    select: {
      id: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
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

export async function createTeacherName(ctx: TeacherContext, fullName: string) {
  const teacherId = ctx.userId;
  await requireMasterTeacher(teacherId, "add teacher names");
  const name = fullName.trim();
  const existing = await prisma.teacherName.findUnique({ where: { name } });
  if (existing) {
    throw new AppError(409, "TEACHER_EXISTS", "This name is already listed");
  }

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
  // Batched: one grouped count instead of N count+delete round trips.
  const remaining = pairs.length
    ? await prisma.sectionTimetableEntry.groupBy({
        by: ["sectionId", "subjectId"],
        where: {
          termId,
          OR: pairs.map((p) => ({ sectionId: p.sectionId, subjectId: p.subjectId })),
        },
        _count: { _all: true },
      })
    : [];
  const stillUsed = new Set(remaining.map((r) => `${r.sectionId}::${r.subjectId}`));
  const orphaned = pairs.filter((p) => !stillUsed.has(`${p.sectionId}::${p.subjectId}`));
  if (orphaned.length > 0) {
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { termId, OR: orphaned.map((p) => ({ sectionId: p.sectionId, subjectId: p.subjectId })) },
    });
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
    select: {
      id: true,
      teacherId: true,
      subjectId: true,
      sectionId: true,
      termId: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
    },
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
