import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { gradeToNumber, resolveSchoolYear, toGradeLevel } from "../../modules/registry/registry.repository.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

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

export async function listTerms(query: SectionsQuery) {

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
