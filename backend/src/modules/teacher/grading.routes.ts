import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { invalidateGradingCaches } from "./grading.repository.js";
import {
  assessmentPatchSchema,
  assessmentSchema,
  componentSchema,
  presetSchema,
} from "./grading.schemas.js";
import {
  applyPreset,
  createAssessment,
  deleteAssessment,
  getClassWorkspace,
  patchAssessment,
  upsertComponent,
} from "../../services/teacher/grading.service.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

async function gradingCtxOf(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
    resolvedTermId: await resolveActiveTermId(req),
  };
}

router.get(
  "/classes/:assignmentId",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      res.json(await getClassWorkspace(await gradingCtxOf(req), String(req.params.assignmentId)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/classes/:assignmentId/components",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", componentSchema),
  async (req, res, next) => {
    try {
      const { componentType, weightPercentage } = req.body as {
        componentType: "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";
        weightPercentage: number;
      };
      const component = await upsertComponent(await gradingCtxOf(req), String(req.params.assignmentId), {
        componentType,
        weightPercentage,
      });

      await invalidateGradingCaches();

      res.status(201).json(component);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/classes/:assignmentId/components/preset",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", presetSchema),
  async (req, res, next) => {
    try {
      const { preset } = req.body as {
        preset: "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE";
      };
      const result = await applyPreset(await gradingCtxOf(req), String(req.params.assignmentId), preset);
      await invalidateGradingCaches();

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/classes/:assignmentId/assessments",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", assessmentSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        componentType: "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";
        title: string;
        maxScore: number;
        dateGiven?: string;
      };
      const assessment = await createAssessment(await gradingCtxOf(req), String(req.params.assignmentId), {
        componentType: body.componentType,
        title: body.title,
        maxScore: body.maxScore,
        dateGiven: body.dateGiven,
      });
      await invalidateGradingCaches();

      res.status(201).json(assessment);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/assessments/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", assessmentPatchSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { title?: string; maxScore?: number; dateGiven?: string };
      const updated = await patchAssessment(await gradingCtxOf(req), String(req.params.id), {
        title: body.title,
        maxScore: body.maxScore,
        dateGiven: body.dateGiven,
      });
      await invalidateGradingCaches();

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/assessments/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const result = await deleteAssessment(await gradingCtxOf(req), String(req.params.id));
      await invalidateGradingCaches();

      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
