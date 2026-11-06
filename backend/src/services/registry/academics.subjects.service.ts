import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import { rosterCountsByGrade, rosterCountsBySection } from "../enrollment.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { gradeToNumber, parseCategory, toCategoryLabel, toGradeLevel } from "../../modules/registry/registry.repository.js";
import type { DeskIdentity, RegistryContext } from "./registry.types.js";

export async function listSubjects(ctx: RegistryContext) {
  const band = ctx.band;
  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: band } },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
  });

  const rosterByGrade = await rosterCountsByGrade([...band]);
  const result = await Promise.all(
    subjects.map(async (s) => {

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

export interface SubjectStudentsQuery {
  band: GradeLevel[];
  subjectId: string;
  desk: DeskIdentity;
}

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
