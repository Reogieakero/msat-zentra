import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { gradeToNumber } from "../../modules/registry/registry.repository.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

export interface TeacherLoadQuery {
  band: GradeLevel[];
}

export async function listTeacherLoads(band: GradeLevel[]) {
  const teachers = await prisma.user.findMany({
    where: {
      role: { in: ["subject_teacher", "adviser"] },
      status: "active",
    },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const loads = await prisma.teacherSubjectAssignment.findMany({
    where: {
      section: { schoolYear: { isActive: true }, gradeLevel: { in: band } },
    },
    select: {
      teacherId: true,
      subjectId: true,
      subject: { select: { code: true, name: true, gradeLevel: true } },
      section: { select: { id: true, name: true } },
      term: { select: { termNumber: true } },
    },
    orderBy: [{ subject: { code: "asc" } }, { section: { name: "asc" } }],
  });

  const byTeacher = new Map<
    string,
    Map<string, { subjectId: string; code: string; name: string; gradeLevel: number; sections: string[]; terms: number[] }>
  >();
  for (const l of loads) {
    const subjectKey = l.subjectId;
    let subjectMap = byTeacher.get(l.teacherId);
    if (!subjectMap) {
      subjectMap = new Map();
      byTeacher.set(l.teacherId, subjectMap);
    }
    let entry = subjectMap.get(subjectKey);
    if (!entry) {
      entry = {
        subjectId: l.subjectId,
        code: l.subject.code,
        name: l.subject.name,
        gradeLevel: gradeToNumber(l.subject.gradeLevel),
        sections: [],
        terms: [],
      };
      subjectMap.set(subjectKey, entry);
    }
    if (!entry.sections.includes(l.section.name)) entry.sections.push(l.section.name);
    if (!entry.terms.includes(l.term.termNumber)) entry.terms.push(l.term.termNumber);
  }

  return {
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.fullName,
      loads: Array.from((byTeacher.get(t.id) ?? new Map()).values()),
    })),
  };
}

export async function getTeacherDetail(band: GradeLevel[], userId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
    select: { id: true, fullName: true },
  });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

  const advisory = await prisma.section.findMany({
    where: {
      adviserId: userId,
      schoolYear: { isActive: true },
      gradeLevel: { in: band },
    },
    select: { id: true, name: true, gradeLevel: true },
    orderBy: { name: "asc" },
  });

  const assignments = await prisma.teacherSubjectAssignment.findMany({
    where: {
      teacherId: userId,
      section: { schoolYear: { isActive: true }, gradeLevel: { in: band } },
    },
    select: {
      id: true,
      subjectId: true,
      subject: { select: { code: true, name: true, gradeLevel: true } },
      section: { select: { id: true, name: true } },
      term: { select: { termNumber: true } },
    },
    orderBy: [{ subject: { code: "asc" } }, { section: { name: "asc" } }, { term: { termNumber: "asc" } }],
  });

  return {
    teacher: {
      id: teacher.id,
      name: teacher.fullName,
      adviser: advisory.map((s) => ({
        id: s.id,
        name: s.name,
        gradeLevel: gradeToNumber(s.gradeLevel),
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        subjectId: a.subjectId,
        code: a.subject.code,
        name: a.subject.name,
        gradeLevel: gradeToNumber(a.subject.gradeLevel),
        section: a.section.name,
        sectionId: a.section.id,
        term: a.term.termNumber,
      })),
    },
  };
}

export interface CreateAssignmentInput {
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
  term?: string;
}

export async function createAssignment(
  ctx: RegistryContext,
  desk: DeskIdentity,
  input: CreateAssignmentInput,
) {
  const band = ctx.band;
  const { sectionId, subjectId, teacherId, term } = input;
  if (!sectionId || !subjectId || !teacherId || !term) {
    throw new AppError(
      400,
      "MISSING_FIELDS",
      "sectionId, subjectId, teacherId and term are required"
    );
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  if (!band.includes(section.gradeLevel)) {
    throw new AppError(403, "BAND_SCOPE", `Section is outside ${desk.scopeNoun} grade band`);
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

  const termRow = await prisma.term.findFirst({
    where: { schoolYearId: section.schoolYearId, termNumber: Number(term.replace(/\D/g, "")) },
    select: { id: true },
  });
  if (!termRow) throw new AppError(404, "TERM_NOT_FOUND", "Term not found for school year");

  const assignment = await prisma.teacherSubjectAssignment.create({
    data: {
      teacherId,
      subjectId,
      sectionId,
      termId: termRow.id,
    },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      term: { select: { termNumber: true } },
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "create",
    sourceTable: "teacher_subject_assignments",
    sourceId: assignment.id,
    reason: `${desk.deskNoun} assigned teacher to section subject`,
  });

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "teacher_subject_assignments",
    verb: "assigned",
    label: `${assignment.teacher.fullName} to ${assignment.subject.code} (Term ${assignment.term.termNumber})`,
    sourceId: assignment.id,
  });

  return {
    id: assignment.id,
    subjectId: assignment.subject.id,
    subjectCode: assignment.subject.code,
    subjectName: assignment.subject.name,
    teacherId: assignment.teacherId,
    teacherName: assignment.teacher.fullName,
    term: `Term ${assignment.term.termNumber}`,
  };
}

export async function deleteAssignment(ctx: RegistryContext, desk: DeskIdentity, id: string) {
  const band = ctx.band;
  const existing = await prisma.teacherSubjectAssignment.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");

  const section = await prisma.section.findUnique({ where: { id: existing.sectionId } });
  if (section && !band.includes(section.gradeLevel)) {
    throw new AppError(403, "BAND_SCOPE", `Assignment is outside ${desk.scopeNoun} grade band`);
  }

  await prisma.teacherSubjectAssignment.delete({ where: { id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "delete",
    sourceTable: "teacher_subject_assignments",
    sourceId: id,
    reason: `${desk.deskNoun} removed teacher assignment`,
  });

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "teacher_subject_assignments",
    verb: "removed",
    label: `a teacher assignment`,
    sourceId: id,
  });

  return { id, deleted: true };
}
