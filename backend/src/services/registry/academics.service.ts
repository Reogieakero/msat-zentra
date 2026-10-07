import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import { rosterCountsByGrade, rosterCountsBySection } from "../enrollment.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import {
  gradeToNumber,
  parseCategory,
  resolveSchoolYear,
  toCategoryLabel,
  toGradeLevel,
} from "../../modules/registry/registry.repository.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

// List in-band subjects with live enrollment / pass / fail counts derived from
// final grades. No mocked data.
export async function listSubjects(ctx: RegistryContext) {
  const band = ctx.band;
  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: band } },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
  });

  // Roster-aware enrollment: registered profiles plus enlisted roster
  // students with no account yet (they count regardless of account
  // status). Failed counts only explicit Failed remarks so ungraded
  // students are never misreported as failed.
  const rosterByGrade = await rosterCountsByGrade([...band]);
  const result = await Promise.all(
    subjects.map(async (s) => {
      // enrolled = every student in the grade level (they all take the subject)
      const [profiles, passed, failed] = await Promise.all([
        prisma.studentProfile.count({ where: { gradeLevel: s.gradeLevel } }),
        prisma.finalGrade.count({
          where: { subjectId: s.id, remarks: "Passed" },
        }),
        prisma.finalGrade.count({
          where: { subjectId: s.id, remarks: "Failed" },
        }),
      ]);
      const enrolled = profiles + (rosterByGrade.get(s.gradeLevel) ?? 0);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        gradeLevel: gradeToNumber(s.gradeLevel),
        category: toCategoryLabel(s.category),
        active: true,
        enrolled,
        passed,
        failed,
      };
    })
  );

  return { subjects: result };
}

// Desk "Sections & Subjects" landing overview. Returns the active school
// year + active term, and every in-band subject with its total enrollment and a
// per-section breakdown of that enrollment (for the grade-level filter + donut).
// The subjects "active for the term / school year" are the active school year's
// subjects (there is no per-term subject switch in this band).
export async function getAcademicsOverview(ctx: RegistryContext) {
  const band = ctx.band;
  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const activeTerm = await prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { termNumber: true },
  });

  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: band } },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
  });

  // Per-grade section breakdown so we only query each grade once.
  // Roster-aware: enlisted students without accounts count too, including
  // sections that currently hold only roster students.
  const enrollmentsByGrade = await Promise.all(
    band.map(async (gl) => {
      const [rows, yearSections] = await Promise.all([
        prisma.studentProfile.groupBy({
          by: ["sectionId"],
          where: { gradeLevel: gl },
          _count: { _all: true },
        }),
        prisma.section.findMany({
          where: { gradeLevel: gl, schoolYear: { isActive: true } },
          select: { id: true },
        }),
      ]);
      const sectionIds = Array.from(
        new Set([
          ...rows.map((r) => r.sectionId).filter(Boolean),
          ...yearSections.map((s) => s.id),
        ]),
      ) as string[];
      const [sections, rosterCounts] = await Promise.all([
        prisma.section.findMany({
          where: { id: { in: sectionIds } },
          select: { id: true, name: true, gradeLevel: true },
        }),
        rosterCountsBySection(sectionIds),
      ]);
      const map = new Map(rows.map((r) => [r.sectionId, r._count._all]));
      const total =
        rows.reduce((s, r) => s + r._count._all, 0) +
        Array.from(rosterCounts.values()).reduce((s, n) => s + n, 0);
      return {
        gl,
        total,
        sections: sections.map((sec) => ({
          id: sec.id,
          name: sec.name,
          count: (map.get(sec.id) ?? 0) + (rosterCounts.get(sec.id) ?? 0),
        })),
      };
    }),
  );

  const byGrade = new Map(enrollmentsByGrade.map((e) => [e.gl, e]));

  const result = subjects.map((s) => {
    const e = byGrade.get(s.gradeLevel);
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      gradeLevel: gradeToNumber(s.gradeLevel),
      category: toCategoryLabel(s.category),
      active: true,
      enrolled: e?.total ?? 0,
      enrollments: e?.sections ?? [],
    };
  });

  return {
    schoolYear: activeYear?.name ?? null,
    schoolYearId: activeYear?.id ?? null,
    term: activeTerm?.termNumber ?? null,
    subjects: result,
  };
}

export interface CreateSubjectInput {
  code?: string;
  name?: string;
  gradeLevel?: number;
  category?: string;
}

// Create an in-band subject. Codes are unique per grade level, so the same
// code may exist in two grades as separate rows.
export async function createSubject(
  ctx: RegistryContext,
  desk: DeskIdentity,
  input: CreateSubjectInput,
) {
  const band = ctx.band;
  const { code, name, gradeLevel, category } = input;
  if (!code?.trim() || !name?.trim()) {
    throw new AppError(400, "MISSING_FIELDS", "Code and name are required");
  }
  const gl = toGradeLevel(band, Number(gradeLevel));
  const cat = parseCategory(category);

  const normalizedCode = code.trim().toUpperCase();
  const existing = await prisma.subject.findFirst({
    where: { code: normalizedCode, gradeLevel: gl },
  });
  if (existing) {
    throw new AppError(
      409,
      "DUPLICATE_CODE",
      `Subject code already exists for Grade ${gradeToNumber(gl)}`
    );
  }

  const subject = await prisma.subject.create({
    data: {
      code: normalizedCode,
      name: name.trim(),
      gradeLevel: gl,
      category: cat,
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "create",
    sourceTable: "subjects",
    sourceId: subject.id,
    reason: `${desk.deskNoun} created subject`,
  });

  // "enrolled" reflects the students in this grade level who take the
  // subject — derived from student enrollment, not final-grade rows.
  // Roster-enlisted students without accounts count too.
  const [profiles, rosterByGrade] = await Promise.all([
    prisma.studentProfile.count({ where: { gradeLevel: gl } }),
    rosterCountsByGrade([gl]),
  ]);
  const enrolled = profiles + (rosterByGrade.get(gl) ?? 0);

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "subjects",
    verb: "created",
    label: `subject ${subject.name} (${subject.code})`,
    sourceId: subject.id,
  });

  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    gradeLevel: gradeToNumber(subject.gradeLevel),
    category: toCategoryLabel(subject.category),
    active: true,
    enrolled,
    passed: 0,
    failed: 0,
  };
}

export interface UpdateSubjectInput {
  name?: string;
  category?: string;
}

// Update a subject (name + category; code is immutable identity, gradeLevel fixed).
export async function updateSubject(
  ctx: RegistryContext,
  desk: DeskIdentity,
  id: string,
  input: UpdateSubjectInput,
) {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

  const updated = await prisma.subject.update({
    where: { id },
    data: {
      name: input.name?.trim() ? input.name.trim() : existing.name,
      category: input.category === undefined ? existing.category : parseCategory(input.category),
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "update",
    sourceTable: "subjects",
    sourceId: updated.id,
    reason: `${desk.deskNoun} updated subject`,
  });

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "subjects",
    verb: "updated",
    label: `subject ${updated.name} (${updated.code})`,
    sourceId: updated.id,
  });

  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    gradeLevel: gradeToNumber(updated.gradeLevel),
    category: toCategoryLabel(updated.category),
    active: true,
  };
}

// School years (DB-driven; no hardcoded year lists on the client).
export async function listSchoolYears() {
  const years = await prisma.schoolYear.findMany({
    orderBy: { name: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  return { schoolYears: years };
}

export interface SectionsQuery {
  schoolYearId?: string | null;
  termScopeYearId?: string | null;
}

export async function listSections(query: SectionsQuery, band: GradeLevel[]) {
  // Optional ?schoolYearId= lets callers list sections for any year.
  // Defaults to the session's active School Year — pages no longer ask.
  const requestedYearId =
    typeof query.schoolYearId === "string" && query.schoolYearId.trim()
      ? query.schoolYearId.trim()
      : null;
  const scopedYearId = requestedYearId ?? query.termScopeYearId ?? null;
  let targetYear: { id: string; name: string } | null = null;
  if (scopedYearId) {
    targetYear = await prisma.schoolYear.findUnique({
      where: { id: scopedYearId },
      select: { id: true, name: true },
    });
    if (!targetYear && requestedYearId) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
  }
  if (!targetYear) {
    targetYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });
  }
  const schoolYearId = targetYear?.id ?? "__none__";

  const sections = await prisma.section.findMany({
    where: { gradeLevel: { in: band }, schoolYearId },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    include: {
      adviser: { select: { id: true, fullName: true } },
      schoolYear: { select: { id: true, name: true } },
      teacherAssignments: {
        include: {
          subject: { select: { id: true, code: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
          term: { select: { termNumber: true } },
        },
      },
    },
  });

  const result = sections.map((s) => ({
    id: s.id,
    name: s.name,
    gradeLevel: gradeToNumber(s.gradeLevel),
    schoolYear: s.schoolYear?.name ?? targetYear?.name ?? "",
    schoolYearId: s.schoolYearId,
    adviserId: s.adviserId ?? "",
    adviserName: s.adviser?.fullName ?? "",
    assignments: s.teacherAssignments.map((a) => ({
      id: a.id,
      subjectId: a.subject.id,
      subjectCode: a.subject.code,
      subjectName: a.subject.name,
      teacherId: a.teacherId,
      teacherName: a.teacher.fullName,
      term: `Term ${a.term.termNumber}`,
    })),
  }));

  return { sections: result };
}

// Terms for a school year, straight from the database — the Assign Subjects
// dialog populates its Term picker from here instead of a hardcoded list.
// Missing term rows (1–3) are backfilled so every year always offers Term 1–3.
export async function listTerms(query: SectionsQuery) {
  // Defaults to the session's active School Year — pages no longer ask.
  const requestedYearId =
    typeof query.schoolYearId === "string" && query.schoolYearId.trim()
      ? query.schoolYearId.trim()
      : null;
  const scopedTermsYearId = requestedYearId ?? query.termScopeYearId ?? null;
  let targetYear: { id: string; name: string } | null = null;
  if (scopedTermsYearId) {
    targetYear = await prisma.schoolYear.findUnique({
      where: { id: scopedTermsYearId },
      select: { id: true, name: true },
    });
    if (!targetYear && requestedYearId) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
  }
  if (!targetYear) {
    targetYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });
  }
  if (!targetYear) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "No school year found");

  let terms = await prisma.term.findMany({
    where: { schoolYearId: targetYear.id },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true },
  });

  // Backfill Terms 1–3 when a year is missing any of them, so every
  // school year always offers the full Term 1–3 set.
  const have = new Set(terms.map((t) => t.termNumber));
  let backfilled = false;
  if (!have.has(1) || !have.has(2) || !have.has(3)) {
    await prisma.term.createMany({
      data: [1, 2, 3]
        .filter((n) => !have.has(n))
        .map((termNumber) => ({ schoolYearId: targetYear!.id, termNumber })),
      skipDuplicates: true,
    });
    backfilled = true;
    terms = await prisma.term.findMany({
      where: { schoolYearId: targetYear.id },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true },
    });
  }

  return { schoolYearId: targetYear.id, terms, backfilled };
}

export interface CreateSectionInput {
  name?: string;
  gradeLevel?: number;
  schoolYear?: string;
  adviserId?: string;
}

export async function createSection(
  ctx: RegistryContext,
  desk: DeskIdentity,
  input: CreateSectionInput,
) {
  const band = ctx.band;
  const { name, gradeLevel, schoolYear, adviserId } = input;
  if (!name?.trim()) throw new AppError(400, "MISSING_NAME", "Section name is required");
  const gl = toGradeLevel(band, Number(gradeLevel));

  const schoolYearRow = await resolveSchoolYear(schoolYear);

  const duplicate = await prisma.section.findFirst({
    where: {
      name: name.trim(),
      gradeLevel: gl,
      schoolYearId: schoolYearRow.id,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      409,
      "DUPLICATE_SECTION",
      `Section "${name.trim()}" already exists for this grade level and school year`
    );
  }

  if (adviserId) {
    const adv = await prisma.user.findUnique({ where: { id: adviserId } });
    if (!adv) throw new AppError(404, "ADVISER_NOT_FOUND", "Adviser not found");
  }

  const section = await prisma.section.create({
    data: {
      name: name.trim(),
      gradeLevel: gl,
      schoolYearId: schoolYearRow.id,
      adviserId: adviserId || null,
    },
    include: {
      adviser: { select: { id: true, fullName: true } },
      schoolYear: { select: { name: true } },
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "create",
    sourceTable: "sections",
    sourceId: section.id,
    reason: `${desk.deskNoun} created section`,
  });

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "sections",
    verb: "created",
    label: `section ${section.name}`,
    sourceId: section.id,
  });

  return {
    id: section.id,
    name: section.name,
    gradeLevel: gradeToNumber(section.gradeLevel),
    schoolYear: section.schoolYear?.name ?? schoolYearRow.name,
    schoolYearId: section.schoolYearId,
    adviserId: section.adviserId ?? "",
    adviserName: section.adviser?.fullName ?? "",
    assignments: [],
  };
}

export interface UpdateSectionInput {
  name?: string;
  adviserId?: string;
}

export async function updateSection(
  ctx: RegistryContext,
  desk: DeskIdentity,
  id: string,
  input: UpdateSectionInput,
) {
  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");

  if (input.adviserId) {
    const adv = await prisma.user.findUnique({ where: { id: input.adviserId } });
    if (!adv) throw new AppError(404, "ADVISER_NOT_FOUND", "Adviser not found");
  }

  const updated = await prisma.section.update({
    where: { id },
    data: {
      name: input.name?.trim() ?? existing.name,
      adviserId: input.adviserId === undefined ? undefined : input.adviserId || null,
    },
    include: {
      adviser: { select: { id: true, fullName: true } },
      schoolYear: { select: { name: true } },
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "update",
    sourceTable: "sections",
    sourceId: updated.id,
    reason: `${desk.deskNoun} updated section`,
  });

  await notifyAcademicsSelf({
    userId: ctx.userId,
    sourceTable: "sections",
    verb: "updated",
    label: `section ${updated.name}`,
    sourceId: updated.id,
  });

  return {
    id: updated.id,
    name: updated.name,
    gradeLevel: gradeToNumber(updated.gradeLevel),
    schoolYear: updated.schoolYear?.name ?? "",
    schoolYearId: updated.schoolYearId,
    adviserId: updated.adviserId ?? "",
    adviserName: updated.adviser?.fullName ?? "",
  };
}

export interface TeacherLoadQuery {
  band: GradeLevel[];
}

// Teacher subject loads for the active school year, within the desk grade
// band. Grouped per teacher + subject, listing the sections each subject is
// taught in and the term(s).
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

// Single teacher with their full workload/assignment rows for the active
// school year within the desk grade band. One row per section+term.
export async function getTeacherDetail(band: GradeLevel[], userId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
    select: { id: true, fullName: true },
  });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

  // Advisory section(s) the teacher leads, distinct from subject loads.
  // Only for the active school year within the desk grade band.
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

export interface SubjectStudentsQuery {
  band: GradeLevel[];
  subjectId: string;
  desk: DeskIdentity;
}

// Students in the subject's grade level. Every student in the grade level takes
// the subject, so this lists ALL of them — including enlisted students without
// accounts and those who do not yet have a final grade recorded. Live data;
// final grade / remarks are shown when present.
export async function getSubjectStudents(query: SubjectStudentsQuery) {
  const { band, subjectId: id, desk } = query;
  const subject = await prisma.subject.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, gradeLevel: true, category: true },
  });
  if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
  if (!band.includes(subject.gradeLevel)) {
    throw new AppError(403, "BAND_SCOPE", `Subject is outside ${desk.scopeNoun} grade band`);
  }

  // Roster scope: the active school year, so last years' enlistments
  // don't duplicate current ones.
  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const [students, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { gradeLevel: subject.gradeLevel },
      select: {
        userId: true,
        lrn: true,
        user: { select: { fullName: true, status: true } },
        section: { select: { name: true } },
        finalGrades: {
          where: { subjectId: id },
          select: {
            transmutedGrade: true,
            remarks: true,
          },
        },
      },
      orderBy: { lrn: "asc" },
    }),
    prisma.studentRoster.findMany({
      where: {
        gradeLevel: subject.gradeLevel,
        ...(activeYear ? { schoolYearId: activeYear.id } : {}),
      },
      select: {
        id: true,
        lrn: true,
        fullName: true,
        section: { select: { name: true } },
        finalGrades: {
          where: { subjectId: id },
          select: {
            transmutedGrade: true,
            remarks: true,
          },
        },
      },
      orderBy: { lrn: "asc" },
    }),
  ]);
  const registeredLrns = new Set(students.map((s) => s.lrn));

  const toRow = (
    grade: { transmutedGrade: number | null; remarks: unknown } | undefined,
  ) => {
    const hasGrade = grade != null && grade.transmutedGrade != null;
    return {
      finalGrade: hasGrade ? (grade!.transmutedGrade as number) : 0,
      remarks: hasGrade
        ? grade!.remarks === "Failed"
          ? ("Failed" as const)
          : ("Passed" as const)
        : ("No grade yet" as const),
    };
  };

  const result = [
    ...students.map((s) => ({
      id: s.userId,
      lrn: s.lrn,
      name: s.user.fullName,
      gradeLevel: gradeToNumber(subject.gradeLevel),
      section: s.section?.name ?? "—",
      ...toRow(s.finalGrades[0]),
      hasAccount: true as const,
      status:
        s.user.status === "active"
          ? ("active" as const)
          : s.user.status === "pending"
            ? ("pending" as const)
            : ("suspended" as const),
    })),
    ...rosterEntries
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        id: `roster:${r.id}`,
        lrn: r.lrn,
        name: r.fullName,
        gradeLevel: gradeToNumber(subject.gradeLevel),
        section: r.section?.name ?? "—",
        ...toRow(r.finalGrades[0]),
        hasAccount: false as const,
        status: "pending" as const,
      })),
  ];

  return {
    subject: {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      gradeLevel: gradeToNumber(subject.gradeLevel),
      category: toCategoryLabel(subject.category),
    },
    students: result,
  };
}
