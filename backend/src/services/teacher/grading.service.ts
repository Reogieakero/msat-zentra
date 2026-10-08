import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import {
  DEPED_JHS_WEIGHTS,
  DEPED_SHS_WEIGHTS,
  type DepEdWeights,
} from "../grading.js";
import {
  COMPONENT_LABELS,
  assertAssignment,
  assertSubjectAccess,
  refreshFinals,
} from "../../modules/teacher/grading.repository.js";
import type { TeacherContext } from "./teacher.types.js";

export interface GradingContext extends TeacherContext {

  resolvedTermId: string | null;
}

function weightsForPreset(preset: "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE"): DepEdWeights {
  if (preset === "SHS") return DEPED_SHS_WEIGHTS;
  const found = DEPED_JHS_WEIGHTS[
    preset === "JHS_LANG" ? 0 : preset === "JHS_MATH_SCI" ? 1 : 2
  ];
  return found.weights;
}

export async function getClassWorkspace(ctx: GradingContext, assignmentId: string) {
  const teacherId = ctx.userId;
  const termId = ctx.resolvedTermId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const a = await assertAssignment(teacherId, assignmentId, termId);

  const [profiles, rosterEntries, components] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: a.sectionId },
      select: {
        userId: true,
        lrn: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: a.sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.gradeComponent.findMany({
      where: { subjectId: a.subjectId, termId: a.termId },
      include: {
        assessments: {
          include: {
            studentGrades: { select: { studentId: true, rosterId: true, rawScore: true } },
          },
          orderBy: { dateGiven: "asc" },
        },
      },
      orderBy: { componentType: "asc" },
    }),
  ]);

  const studentIds = profiles.map((p) => p.userId);
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const [profileFinals, rosterFinals] = await Promise.all([
    prisma.finalGrade.findMany({
      where: { subjectId: a.subjectId, termId: a.termId, studentId: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        computedAverage: true,
        transmutedGrade: true,
        remarks: true,
        lockStatus: true,
      },
    }),
    rosterOnly.length > 0
      ? prisma.finalGrade.findMany({
          where: {
            subjectId: a.subjectId,
            termId: a.termId,
            rosterId: { in: rosterOnly.map((r) => r.id) },
          },
          select: {
            id: true,
            rosterId: true,
            computedAverage: true,
            transmutedGrade: true,
            remarks: true,
            lockStatus: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const finalByStudent = new Map(profileFinals.map((f) => [f.studentId as string, f]));
  const finalByRoster = new Map(rosterFinals.map((f) => [`roster:${f.rosterId}`, f]));

  return {
    assignment: {
      id: a.id,
      subjectId: a.subject.id,
      subjectCode: a.subject.code,
      subjectName: a.subject.name,
      subjectCategory: a.subject.category,
      sectionId: a.section.id,
      sectionName: a.section.name,
      gradeLevel: a.section.gradeLevel,
      termId: a.term.id,
      termNumber: a.term.termNumber,
      schoolYear: a.term.schoolYear.name,
    },

    students: [
      ...profiles.map((p) => ({
        id: p.userId,
        name: p.user.fullName,
        lrn: p.lrn,
        hasAccount: true as const,
        final: finalByStudent.get(p.userId) ?? null,
      })),
      ...rosterOnly.map((r) => ({
        id: `roster:${r.id}`,
        name: r.fullName,
        lrn: r.lrn,
        hasAccount: false as const,
        final: finalByRoster.get(`roster:${r.id}`) ?? null,
      })),
    ].sort((x, y) => x.name.localeCompare(y.name)),
    components: components.map((c) => ({
      id: c.id,
      type: c.componentType,
      label: COMPONENT_LABELS[c.componentType] ?? c.componentType,
      weight: c.weightPercentage,
      assessments: c.assessments.map((as) => ({
        id: as.id,
        title: as.title,
        maxScore: as.maxScore,
        dateGiven: as.dateGiven.toISOString().slice(0, 10),
        createdAt: as.createdAt.toISOString().slice(0, 10),
        scores: Object.fromEntries(
          as.studentGrades.map((g) => [
            g.rosterId ? `roster:${g.rosterId}` : (g.studentId as string),
            g.rawScore,
          ]),
        ),
      })),
    })),
  };
}

export interface UpsertComponentInput {
  componentType: "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";
  weightPercentage: number;
}

export async function upsertComponent(
  ctx: GradingContext,
  assignmentId: string,
  input: UpsertComponentInput,
) {
  const teacherId = ctx.userId;
  const termId = ctx.resolvedTermId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const a = await assertAssignment(teacherId, assignmentId, termId);
  const { componentType, weightPercentage } = input;

  const component = await prisma.gradeComponent.upsert({
    where: {
      subjectId_termId_componentType: {
        subjectId: a.subjectId,
        termId: a.termId,
        componentType,
      },
    },
    create: {
      subjectId: a.subjectId,
      termId: a.termId,
      componentType,
      weightPercentage,
    },
    update: { weightPercentage },
  });

  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "grade_components",
    sourceId: component.id,
    reason: `Set ${componentType} weight to ${weightPercentage}% for ${a.subject.name}`,
  });

  await refreshFinals(a.subjectId, a.termId);

  return {
    id: component.id,
    type: component.componentType,
    label: COMPONENT_LABELS[component.componentType] ?? component.componentType,
    weight: component.weightPercentage,
  };
}

export async function applyPreset(
  ctx: GradingContext,
  assignmentId: string,
  preset: "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE",
) {
  const teacherId = ctx.userId;
  const termId = ctx.resolvedTermId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const a = await assertAssignment(teacherId, assignmentId, termId);
  const weights = weightsForPreset(preset);

  const saved = await prisma.$transaction(
    (Object.keys(weights) as (keyof DepEdWeights)[]).map((componentType) =>
      prisma.gradeComponent.upsert({
        where: {
          subjectId_termId_componentType: {
            subjectId: a.subjectId,
            termId: a.termId,
            componentType,
          },
        },
        create: {
          subjectId: a.subjectId,
          termId: a.termId,
          componentType,
          weightPercentage: weights[componentType],
        },
        update: { weightPercentage: weights[componentType] },
      }),
    ),
  );

  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "grade_components",
    sourceId: a.id,
    reason: `Applied DepEd weight preset ${preset} to ${a.subject.name}`,
  });
  await refreshFinals(a.subjectId, a.termId);

  return {
    preset,
    components: saved.map((c) => ({
      id: c.id,
      type: c.componentType,
      label: COMPONENT_LABELS[c.componentType] ?? c.componentType,
      weight: c.weightPercentage,
    })),
  };
}

export interface CreateAssessmentInput {
  componentType: "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";
  title: string;
  maxScore: number;
  dateGiven?: string;
}

export async function createAssessment(
  ctx: GradingContext,
  assignmentId: string,
  input: CreateAssessmentInput,
) {
  const teacherId = ctx.userId;
  const termId = ctx.resolvedTermId;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const a = await assertAssignment(teacherId, assignmentId, termId);

  let component = await prisma.gradeComponent.findUnique({
    where: {
      subjectId_termId_componentType: {
        subjectId: a.subjectId,
        termId: a.termId,
        componentType: input.componentType,
      },
    },
  });
  if (!component) {

    const isSHS = a.section.gradeLevel === "G11" || a.section.gradeLevel === "G12";
    component = await prisma.gradeComponent.create({
      data: {
        subjectId: a.subjectId,
        termId: a.termId,
        componentType: input.componentType,
        weightPercentage: isSHS ? DEPED_SHS_WEIGHTS[input.componentType] : 0,
      },
    });
  }

  const assessment = await prisma.assessment.create({
    data: {
      gradeComponentId: component.id,
      title: input.title.trim(),
      maxScore: input.maxScore,
      dateGiven: input.dateGiven ? new Date(input.dateGiven) : new Date(),
      createdBy: teacherId,
    },
  });

  await writeAudit({
    userId: teacherId,
    actionType: "create",
    sourceTable: "assessments",
    sourceId: assessment.id,
    reason: `Added ${input.componentType} assessment "${assessment.title}" to ${a.subject.name}`,
  });

  return {
    id: assessment.id,
    title: assessment.title,
    maxScore: assessment.maxScore,
    dateGiven: assessment.dateGiven.toISOString().slice(0, 10),
    createdAt: assessment.createdAt.toISOString().slice(0, 10),
    scores: {},
  };
}

export interface PatchAssessmentInput {
  title?: string;
  maxScore?: number;
  dateGiven?: string;
}

export async function patchAssessment(
  ctx: GradingContext,
  assessmentId: string,
  input: PatchAssessmentInput,
) {
  const teacherId = ctx.userId;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { gradeComponent: { select: { subjectId: true, termId: true } } },
  });
  if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");
  await assertSubjectAccess(teacherId, assessment.gradeComponent.subjectId, assessment.gradeComponent.termId);

  const maxChanged =
    input.maxScore !== undefined && input.maxScore !== assessment.maxScore;
  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
      ...(input.dateGiven !== undefined ? { dateGiven: new Date(input.dateGiven) } : {}),
    },
  });

  if (maxChanged) {
    const rows = await prisma.studentGrade.findMany({
      where: { assessmentId: assessment.id },
      select: { id: true, rawScore: true, studentId: true, rosterId: true },
    });
    await prisma.$transaction(
      rows.map((g) =>
        prisma.studentGrade.update({
          where: { id: g.id },
          data: { percentageScore: (g.rawScore / updated.maxScore) * 100 },
        }),
      ) as never[],
    );
    const keys = rows.map((g) =>
      g.studentId ? { studentId: g.studentId } : { rosterId: g.rosterId as string },
    );
    await refreshFinals(
      assessment.gradeComponent.subjectId,
      assessment.gradeComponent.termId,
      keys,
    );
  }

  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "assessments",
    sourceId: updated.id,
    reason: `Updated assessment "${updated.title}"`,
  });

  return {
    id: updated.id,
    title: updated.title,
    maxScore: updated.maxScore,
    dateGiven: updated.dateGiven.toISOString().slice(0, 10),
  };
}

export async function deleteAssessment(ctx: GradingContext, assessmentId: string) {
  const teacherId = ctx.userId;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { gradeComponent: { select: { subjectId: true, termId: true } } },
  });
  if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");
  await assertSubjectAccess(teacherId, assessment.gradeComponent.subjectId, assessment.gradeComponent.termId);

  const scored = await prisma.studentGrade.findMany({
    where: { assessmentId: assessment.id },
    select: { studentId: true, rosterId: true },
  });
  await prisma.assessment.delete({ where: { id: assessment.id } });
  await refreshFinals(
    assessment.gradeComponent.subjectId,
    assessment.gradeComponent.termId,
    scored.map((g) =>
      g.studentId ? { studentId: g.studentId } : { rosterId: g.rosterId as string },
    ),
  );

  await writeAudit({
    userId: teacherId,
    actionType: "delete",
    sourceTable: "assessments",
    sourceId: assessment.id,
    reason: `Deleted assessment "${assessment.title}"`,
  });

  return { id: assessment.id, deleted: true };
}
