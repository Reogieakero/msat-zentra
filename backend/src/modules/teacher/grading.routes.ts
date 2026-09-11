import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import {
  DEPED_JHS_WEIGHTS,
  DEPED_SHS_WEIGHTS,
  finalKeysForSubjectTerm,
  recomputeSubjectFinal,
  type DepEdWeights,
  type StudentKey,
} from "../../services/grading.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

const COMPONENT_TYPES = ["WRITTEN_WORK", "PERFORMANCE_TASK", "QUARTERLY_EXAM"] as const;

export const COMPONENT_LABELS: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

// Recompute finals for the given students (or every holder when keys are
// omitted) and refresh their risk rows. Keeps every downstream view —
// workspace finals, academic records, pipelines — live on each mutation.
async function refreshFinals(
  subjectId: string,
  termId: string,
  keys?: StudentKey[],
): Promise<void> {
  const targets = keys ?? (await finalKeysForSubjectTerm(subjectId, termId));
  await Promise.all(targets.map((k) => recomputeSubjectFinal(k, subjectId, termId)));
  const profileIds = Array.from(
    new Set(targets.flatMap((k) => ("studentId" in k ? [k.studentId] : []))),
  );
  const rosterIds = Array.from(
    new Set(targets.flatMap((k) => ("rosterId" in k ? [k.rosterId] : []))),
  );
  await Promise.all(profileIds.map((id) => recomputeRisk(id, termId)));
  await Promise.all(rosterIds.map((id) => recomputeRosterRisk(id, termId)));
}

async function invalidateGradingCaches(): Promise<void> {
  await invalidateTags(["teacher", "registrar", "academics", "overview", "principal"]);
}

// Grade components are school-wide per (subject, term), so ownership for
// component/assessment management means: the caller must hold at least one
// TeacherSubjectAssignment for that subject + term (any section).
async function assertSubjectAccess(teacherId: string, subjectId: string, termId: string) {
  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, termId },
    select: { id: true },
  });
  if (!assignment) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }
  return assignment;
}

// A class is one TeacherSubjectAssignment row (subject × section × term) that
// must belong to the caller — 404 otherwise (uniform, no probing).
async function assertAssignment(teacherId: string, assignmentId: string) {
  const assignment = await prisma.teacherSubjectAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      term: {
        select: { id: true, termNumber: true, schoolYear: { select: { id: true, name: true } } },
      },
    },
  });
  if (!assignment || assignment.teacherId !== teacherId) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }
  return assignment;
}

// GET /api/teacher/grading/classes/:assignmentId — everything the class
// workspace needs: assignment meta, section students (registered profiles
// with their final grade for this subject + term), enlisted students without
// accounts (read-only — scoring requires a profile), components with weights,
// and assessments with per-student scores.
router.get(
  "/classes/:assignmentId",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const a = await assertAssignment(teacherId, String(req.params.assignmentId));

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

      res.json({
        assignment: {
          id: a.id,
          subjectId: a.subject.id,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          sectionId: a.section.id,
          sectionName: a.section.name,
          gradeLevel: a.section.gradeLevel,
          termId: a.term.id,
          termNumber: a.term.termNumber,
          schoolYear: a.term.schoolYear.name,
        },
        // Registered profiles first, then enlisted students without
        // accounts — both are scorable rows (`roster:<id>` keys for the
        // latter), sorted by name.
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
            scores: Object.fromEntries(
              as.studentGrades.map((g) => [
                g.rosterId ? `roster:${g.rosterId}` : (g.studentId as string),
                g.rawScore,
              ]),
            ),
          })),
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

const componentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  weightPercentage: z.number().int().min(0).max(100),
});

// POST /api/teacher/grading/classes/:assignmentId/components — create or
// update the weight for one WW/PT/QE category of the class subject + term.
router.post(
  "/classes/:assignmentId/components",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", componentSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const a = await assertAssignment(teacherId, String(req.params.assignmentId));
      const { componentType, weightPercentage } = req.body as z.infer<typeof componentSchema>;

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
      // Weights reshape every final in the subject + term — recompute them now.
      await refreshFinals(a.subjectId, a.termId);
      await invalidateGradingCaches();

      res.status(201).json({
        id: component.id,
        type: component.componentType,
        label: COMPONENT_LABELS[component.componentType] ?? component.componentType,
        weight: component.weightPercentage,
      });
    } catch (e) {
      next(e);
    }
  }
);

const PRESETS = ["SHS", "JHS_LANG", "JHS_MATH_SCI", "JHS_MAPEH_TLE"] as const;

const presetSchema = z.object({
  preset: z.enum(PRESETS),
});

function weightsForPreset(preset: (typeof PRESETS)[number]): DepEdWeights {
  if (preset === "SHS") return DEPED_SHS_WEIGHTS;
  const found = DEPED_JHS_WEIGHTS[
    preset === "JHS_LANG" ? 0 : preset === "JHS_MATH_SCI" ? 1 : 2
  ];
  return found.weights;
}

// POST /api/teacher/grading/classes/:assignmentId/components/preset — apply
// a DepEd Order No. 8 weight set (WW/PT/QA) to all three categories at once.
router.post(
  "/classes/:assignmentId/components/preset",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", presetSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const a = await assertAssignment(teacherId, String(req.params.assignmentId));
      const { preset } = req.body as z.infer<typeof presetSchema>;
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
      await invalidateGradingCaches();

      res.status(201).json({
        preset,
        components: saved.map((c) => ({
          id: c.id,
          type: c.componentType,
          label: COMPONENT_LABELS[c.componentType] ?? c.componentType,
          weight: c.weightPercentage,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

const assessmentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  title: z.string().trim().min(1).max(120),
  maxScore: z.number().positive().max(100000),
  dateGiven: z.string().datetime().optional(),
});

// POST /api/teacher/grading/classes/:assignmentId/assessments — add a WW/PT/QE
// assessment (quiz, activity, exam…). The category row is auto-created at
// weight 0 when missing so entry never blocks on ordering.
router.post(
  "/classes/:assignmentId/assessments",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", assessmentSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const a = await assertAssignment(teacherId, String(req.params.assignmentId));
      const body = req.body as z.infer<typeof assessmentSchema>;

      let component = await prisma.gradeComponent.findUnique({
        where: {
          subjectId_termId_componentType: {
            subjectId: a.subjectId,
            termId: a.termId,
            componentType: body.componentType,
          },
        },
      });
      if (!component) {
        // Senior High classes start at the DepEd standard weight for the
        // category; Junior High varies by learning area, so it starts at 0
        // until the teacher picks a preset or sets weights manually.
        const isSHS = a.section.gradeLevel === "G11" || a.section.gradeLevel === "G12";
        component = await prisma.gradeComponent.create({
          data: {
            subjectId: a.subjectId,
            termId: a.termId,
            componentType: body.componentType,
            weightPercentage: isSHS ? DEPED_SHS_WEIGHTS[body.componentType] : 0,
          },
        });
      }

      const assessment = await prisma.assessment.create({
        data: {
          gradeComponentId: component.id,
          title: body.title.trim(),
          maxScore: body.maxScore,
          dateGiven: body.dateGiven ? new Date(body.dateGiven) : new Date(),
          createdBy: teacherId,
        },
      });

      await writeAudit({
        userId: teacherId,
        actionType: "create",
        sourceTable: "assessments",
        sourceId: assessment.id,
        reason: `Added ${body.componentType} assessment "${assessment.title}" to ${a.subject.name}`,
      });
      await invalidateTags(["teacher"]);

      res.status(201).json({
        id: assessment.id,
        title: assessment.title,
        maxScore: assessment.maxScore,
        dateGiven: assessment.dateGiven.toISOString().slice(0, 10),
        scores: {},
      });
    } catch (e) {
      next(e);
    }
  }
);

const assessmentPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  maxScore: z.number().positive().max(100000).optional(),
  dateGiven: z.string().datetime().optional(),
});

// PATCH /api/teacher/grading/assessments/:id — rename / rescale / redate.
// Ownership: the caller must hold an assignment for the assessment's
// subject + term (components are shared school-wide per subject + term).
router.patch(
  "/assessments/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", assessmentPatchSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const assessment = await prisma.assessment.findUnique({
        where: { id: String(req.params.id) },
        include: { gradeComponent: { select: { subjectId: true, termId: true } } },
      });
      if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");
      await assertSubjectAccess(teacherId, assessment.gradeComponent.subjectId, assessment.gradeComponent.termId);

      const body = req.body as z.infer<typeof assessmentPatchSchema>;
      const maxChanged =
        body.maxScore !== undefined && body.maxScore !== assessment.maxScore;
      const updated = await prisma.assessment.update({
        where: { id: assessment.id },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.maxScore !== undefined ? { maxScore: body.maxScore } : {}),
          ...(body.dateGiven !== undefined ? { dateGiven: new Date(body.dateGiven) } : {}),
        },
      });

      // Rescaling the max rewrites every recorded percentage (raw scores are
      // kept), then every affected final is recomputed so nothing goes stale.
      if (maxChanged) {
        const rows = await prisma.studentGrade.findMany({
          where: { assessmentId: assessment.id },
          select: { id: true, rawScore: true, studentId: true, rosterId: true },
        });
        await Promise.all(
          rows.map((g) =>
            prisma.studentGrade.update({
              where: { id: g.id },
              data: { percentageScore: (g.rawScore / updated.maxScore) * 100 },
            }),
          ),
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
      await invalidateGradingCaches();

      res.json({
        id: updated.id,
        title: updated.title,
        maxScore: updated.maxScore,
        dateGiven: updated.dateGiven.toISOString().slice(0, 10),
      });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /api/teacher/grading/assessments/:id — removes the assessment and
// its encoded scores (same ownership rule as PATCH).
router.delete(
  "/assessments/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const assessment = await prisma.assessment.findUnique({
        where: { id: String(req.params.id) },
        include: { gradeComponent: { select: { subjectId: true, termId: true } } },
      });
      if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");
      await assertSubjectAccess(teacherId, assessment.gradeComponent.subjectId, assessment.gradeComponent.termId);

      // Capture who was scored before the cascade-delete wipes the rows, so
      // their finals recompute without the ghost assessment.
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
      await invalidateGradingCaches();

      res.json({ id: assessment.id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
