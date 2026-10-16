import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { SCHEDULE_CONFIG_DEFAULTS, resolveWorkloadCaps, toScheduleConfig } from "../../modules/teacher/teacher.repository.js";
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

export interface ScheduleConflict {
  teacherNameId: string;
  teacherName: string;
  day: number;
  period: number;
  sections: Array<{ sectionId: string; sectionName: string; subjectName: string }>;
}

export async function getScheduleConflicts(
  ctx: TeacherContext,
  caps?: { maxDailyPeriods?: unknown; maxWeeklyPeriods?: unknown },
) {
  const termId = ctx.termId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const entries = await prisma.sectionTimetableEntry.findMany({
    where: { termId, teacherNameId: { not: null } },
    select: {
      teacherNameId: true,
      day: true,
      period: true,
      sectionId: true,
      section: { select: { name: true } },
      subject: { select: { name: true, category: true } },
      teacherName: { select: { name: true } },
    },
  });
  const byKey = new Map<string, ScheduleConflict>();
  for (const e of entries) {
    if (!e.teacherNameId) continue;
    const key = `${e.teacherNameId}:${e.day}:${e.period}`;
    const slot = byKey.get(key) ?? {
      teacherNameId: e.teacherNameId,
      teacherName: e.teacherName?.name ?? "Teacher",
      day: e.day,
      period: e.period,
      sections: [],
    };
    slot.sections.push({
      sectionId: e.sectionId,
      sectionName: e.section?.name ?? "Section",
      subjectName: e.subject?.name ?? "Subject",
    });
    byKey.set(key, slot);
  }
  const conflicts = [...byKey.values()].filter((c) => {
    const ids = new Set(c.sections.map((s) => s.sectionId));
    return ids.size > 1;
  });

  // Workload warnings depend on template configuration caps.
  // No DB migration: caps arrive as query params from the template tab
  // (persisted per-term in localStorage), backend falls back to defaults.
  const configRow = await prisma.scheduleConfig.findUnique({ where: { termId } });
  const config = configRow ? toScheduleConfig(configRow) : SCHEDULE_CONFIG_DEFAULTS;
  const capsResolved = resolveWorkloadCaps(caps);
  const perTeacherDay = new Map<string, number>();
  const perTeacherWeek = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    if (!e.teacherNameId) continue;
    const dayKey = `${e.teacherNameId}:${e.day}`;
    perTeacherDay.set(dayKey, (perTeacherDay.get(dayKey) ?? 0) + 1);
    const week = perTeacherWeek.get(e.teacherNameId) ?? {
      name: e.teacherName?.name ?? "Teacher",
      count: 0,
    };
    week.count += 1;
    perTeacherWeek.set(e.teacherNameId, week);
  }
  const workload = {
    maxDailyPeriods: capsResolved.maxDailyPeriods,
    maxWeeklyPeriods: capsResolved.maxWeeklyPeriods,
    overDaily: [...perTeacherDay.entries()]
      .filter(([, n]) => n > capsResolved.maxDailyPeriods)
      .map(([key, count]) => {
        const [teacherNameId, day] = key.split(":");
        return { teacherNameId, day: Number(day), count };
      }),
    overWeekly: [...perTeacherWeek.entries()]
      .filter(([, w]) => w.count > capsResolved.maxWeeklyPeriods)
      .map(([teacherNameId, w]) => ({ teacherNameId, teacherName: w.name, count: w.count })),
  };
  return { conflicts, workload, config };
}
