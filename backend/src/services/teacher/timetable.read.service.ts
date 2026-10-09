import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { SCHEDULE_CONFIG_DEFAULTS, toScheduleConfig } from "../../modules/teacher/teacher.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface ScheduleQueryOpts {
  summary?: boolean;
  sectionId?: string;
  gradeLevel?: string;
}

export async function getSchedule(ctx: TeacherContext, opts?: ScheduleQueryOpts) {
  const termId = ctx.termId;
  const yearId = ctx.schoolYearId;
  const allowedGrades = ["G7", "G8", "G9", "G10"] as const;
  type AllowedGrade = (typeof allowedGrades)[number];
  const gradeLevels: AllowedGrade[] = opts?.gradeLevel
    ? (allowedGrades as readonly string[]).includes(opts.gradeLevel)
      ? [opts.gradeLevel as AllowedGrade]
      : [...allowedGrades]
    : [...allowedGrades];
  const sections = await prisma.section.findMany({
    where: {
      gradeLevel: { in: gradeLevels },
      ...(yearId ? { schoolYearId: yearId } : {}),
      ...(opts?.sectionId ? { id: opts.sectionId } : {}),
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    ...(opts?.summary
      ? {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            adviserId: true,
            adviser: { select: { fullName: true } },
            timetableEntries: {
              where: termId ? { termId } : undefined,
              select: { status: true, reviewNote: true },
            },
            _count: { select: { students: true } },
          },
        }
      : {
          include: {
            adviser: { select: { fullName: true } },
            teacherAssignments: {
              where: termId ? { termId } : undefined,
              include: {
                subject: { select: { id: true, name: true, code: true, gradeLevel: true, category: true } },
                teacher: { select: { fullName: true } },
              },
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
        }),
  });
  return { sections };
}

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

export async function listScheduleSubjects() {
  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: ["G7", "G8", "G9", "G10"] } },
    select: { id: true, name: true, code: true, gradeLevel: true, category: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  return { subjects };
}

export async function getScheduleConfig(ctx: TeacherContext) {
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const row = await prisma.scheduleConfig.findUnique({ where: { termId } });
  return { config: row ? toScheduleConfig(row) : SCHEDULE_CONFIG_DEFAULTS };
}
