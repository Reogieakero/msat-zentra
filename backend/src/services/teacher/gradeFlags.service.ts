import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { runEscalation } from "../gradeFlags.js";
import {
  flagInclude,
  serializeFlag,
  teacherScope,
} from "../../modules/teacher/grade-flags.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface FlagListQuery {
  scope: "mine" | "against-me" | "advisees";
  status?: "open" | "resolved" | "escalated";
  q?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export async function listFlags(ctx: TeacherContext, query: FlagListQuery) {
  const teacherId = ctx.userId;
  const { scope, status, q, page, pageSize, limit } = query;
  const scopeTermId = ctx.termId;
  const termFilter = scopeTermId ? { termId: scopeTermId } : {};

  const rawSize = pageSize ?? limit;
  // Strict 15-record ceiling for normal lists.
  const effPageSize = rawSize && rawSize > 0 ? Math.min(Math.floor(rawSize), 15) : 15;
  const effPage = Math.max(1, page ?? 1);
  // Always paginate: unbounded full-dataset fetch is never allowed for flags.
  const hasPaginationParams = true;

  const needle = q?.trim() ? q.trim() : null;
  const queryFilter = needle
    ? {
        OR: [
          { student: { user: { fullName: { contains: needle, mode: "insensitive" as const } } } },
          { student: { lrn: { contains: needle, mode: "insensitive" as const } } },
          { subject: { name: { contains: needle, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const pagedFlags = async (
    where: Record<string, unknown>,
  ): Promise<unknown> => {
    if (!hasPaginationParams) {
      const rows = await prisma.gradeFlag.findMany({
        where,
        include: flagInclude(),
        orderBy: { createdAt: "desc" },
      });
      return rows.map(serializeFlag);
    }
    const [total, rows] = await Promise.all([
      prisma.gradeFlag.count({ where }),
      prisma.gradeFlag.findMany({
        where,
        include: flagInclude(),
        orderBy: { createdAt: "desc" },
        skip: (effPage - 1) * effPageSize,
        take: effPageSize,
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / effPageSize));
    const safePage = Math.min(effPage, totalPages);
    const data = rows.map(serializeFlag);
    return {
      data,
      rows: data,
      total,
      unfilteredTotal: total,
      summary: { total, filtered: total },
      page: safePage,
      totalPages,
      limit: effPageSize,
      pageSize: effPageSize,
    };
  };

  await runEscalation();

  if (scope === "advisees") {
    const advised = await prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true },
    });
    if (advised.length === 0) {
      throw new AppError(403, "FORBIDDEN", "Adviser scope requires an advisory section");
    }
    const adviseeIds = (
      await prisma.studentProfile.findMany({
        where: { sectionId: { in: advised.map((s) => s.id) } },
        select: { userId: true },
      })
    ).map((s) => s.userId);
    return pagedFlags({
      studentId: { in: adviseeIds },
      ...(status ? { status } : {}),
      ...termFilter,
      ...queryFilter,
    });
  }

  const where =
    scope === "mine"
      ? { raisedBy: teacherId }
      : { ownerId: teacherId };
  return pagedFlags({
    ...where,
    ...(status ? { status } : {}),
    ...termFilter,
    ...queryFilter,
  });
}

export interface FlagOptionsQuery {
  termId: string | null;
}

export async function getFlagOptions(ctx: TeacherContext, query: FlagOptionsQuery) {
  const teacherId = ctx.userId;
  const { assignedSectionIds, advisedSectionIds } = await teacherScope(teacherId);
  const sectionIds = Array.from(new Set([...assignedSectionIds, ...advisedSectionIds]));

  const scopeTermId = query.termId;
  const termFilter = scopeTermId ? { termId: scopeTermId } : {};

  const [profiles, rosterEntries, assignments, sectionClasses, timetableEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: {
        userId: true,
        lrn: true,
        sectionId: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),

    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { id: true, lrn: true, fullName: true, sectionId: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId, ...termFilter },
      include: {
        subject: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        term: { select: { id: true, termNumber: true } },
      },
    }),

    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId: { in: sectionIds }, ...termFilter },
      include: {
        subject: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        term: { select: { id: true, termNumber: true } },
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: [{ sectionId: "asc" }, { subject: { name: "asc" } }],
    }),

    // Timetable fallback: sections whose subjects live only as approved
    // timetable entries (no assignment rows) still need class options, or
    // pickers like Bama chat block every student in that section with
    // "No classes found". Same union pattern as attendance offerings.
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId: { in: sectionIds }, status: { in: ["APPROVED", "SUBMITTED"] }, ...termFilter },
      select: {
        subjectId: true,
        sectionId: true,
        subject: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        term: { select: { id: true, termNumber: true } },
        teacherName: { select: { name: true } },
      },
      orderBy: [{ sectionId: "asc" }, { subject: { name: "asc" } }],
    }),
  ]);

  const registeredLrns = new Set(profiles.map((s) => s.lrn));
  // Assignment rows keep priority: timetable entries only fill sections
  // with zero assignment rows, so existing data never dupes or changes.
  const sectionsWithAssignments = new Set(sectionClasses.map((a) => a.section.id));
  const seenPairs = new Set(sectionClasses.map((a) => `${a.section.id}|${a.subject.id}`));
  const timetableFallback = [];
  for (const t of timetableEntries) {
    if (!t.subject || !t.section || !t.term) continue;
    if (sectionsWithAssignments.has(t.sectionId)) continue;
    const pair = `${t.sectionId}|${t.subjectId}`;
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    timetableFallback.push({
      subjectId: t.subject.id,
      subjectName: t.subject.name,
      sectionId: t.section.id,
      sectionName: t.section.name,
      termId: t.term.id,
      termNumber: t.term.termNumber,
      ownerName: t.teacherName?.name ?? "Timetable",
    });
  }
  return {
    students: [
      ...profiles.map((s) => ({
        id: s.userId,
        name: s.user.fullName,
        lrn: s.lrn,
        sectionId: s.sectionId,
        hasAccount: true as const,
      })),
      ...rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => ({
          id: `roster:${r.id}`,
          name: r.fullName,
          lrn: r.lrn,
          sectionId: r.sectionId,
          hasAccount: false as const,
        })),
    ],
    classes: assignments.map((a) => ({
      subjectId: a.subject.id,
      subjectName: a.subject.name,
      sectionId: a.section.id,
      sectionName: a.section.name,
      termId: a.term.id,
      termNumber: a.term.termNumber,
    })),
    sectionClasses: [
      ...sectionClasses.map((a) => ({
        subjectId: a.subject.id,
        subjectName: a.subject.name,
        sectionId: a.section.id,
        sectionName: a.section.name,
        termId: a.term.id,
        termNumber: a.term.termNumber,
        ownerName: a.teacher.fullName,
      })),
      ...timetableFallback,
    ],
  };
}

export interface RaiseFlagInput {
  studentId: string;
  subjectId: string;
  sectionId: string;
  termId: string;
  reason: "wrong_score" | "missing_assessment" | "transmutation_error" | "late_submission" | "other";
  note?: string;
}

export async function raiseFlag(ctx: TeacherContext, input: RaiseFlagInput) {
  const teacherId = ctx.userId;

  const termId = ctx.termId ?? input.termId;

  const [student, subject, section, term] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: input.studentId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
    prisma.section.findUnique({ where: { id: input.sectionId } }),
    prisma.term.findUnique({ where: { id: termId } }),
  ]);
  if (!student || !subject || !section || !term) {
    throw new AppError(404, "FLAG_TARGET_NOT_FOUND", "Student, subject, section, or term not found");
  }

  const ownerAssignment = await prisma.teacherSubjectAssignment.findFirst({
    where: { subjectId: input.subjectId, sectionId: input.sectionId, termId },
    select: { teacherId: true },
  });

  const flag = await prisma.gradeFlag.create({
    data: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      sectionId: input.sectionId,
      termId,
      reason: input.reason,
      note: input.note,
      raisedBy: teacherId,
      ownerId: ownerAssignment?.teacherId ?? null,
    },
    include: flagInclude(),
  });

  await writeAudit({
    userId: teacherId,
    actionType: "grade_flag_raise",
    sourceTable: "grade_flags",
    sourceId: flag.id,
    reason: `${input.reason} — ${subject.name} / ${section.name}`,
  });

  return serializeFlag(flag);
}

export async function resolveFlag(ctx: TeacherContext, flagId: string, resolutionNote: string) {
  const teacherId = ctx.userId;
  const flag = await prisma.gradeFlag.findUnique({
    where: { id: flagId },
    include: flagInclude(),
  });
  if (!flag) throw new AppError(404, "FLAG_NOT_FOUND", "Grade flag not found");
  if (flag.status === "resolved") {
    throw new AppError(409, "FLAG_ALREADY_RESOLVED", "Flag is already resolved");
  }
  if (flag.ownerId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "Only the gradebook owner can resolve this flag");
  }

  const updated = await prisma.gradeFlag.update({
    where: { id: flag.id },
    data: {
      status: "resolved",
      resolvedBy: teacherId,
      resolvedAt: new Date(),
      resolutionNote,
    },
    include: flagInclude(),
  });

  await writeAudit({
    userId: teacherId,
    actionType: "grade_flag_resolve",
    sourceTable: "grade_flags",
    sourceId: flag.id,
    reason: resolutionNote,
  });

  return serializeFlag(updated);
}
