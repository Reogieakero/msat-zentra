import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { invalidateTags } from "../../lib/cache.js";
import { listQuerySchema, raiseSchema, resolveSchema } from "./grade-flags.schemas.js";
import {
  getFlagOptions,
  listFlags,
  raiseFlag,
  resolveFlag,
} from "../../services/teacher/gradeFlags.service.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

function ctxOf(req: {
  user?: { id: string; role: string };
  termScope?: { termId: string; schoolYearId: string } | null;
}) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

router.get(
  "/",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", listQuerySchema),
  async (req, res, next) => {
    try {
      const { scope, status, q, page, pageSize, limit } = req.query as unknown as {
        scope: "mine" | "against-me" | "advisees";
        status?: "open" | "resolved" | "escalated";
        q?: string;
        page?: number;
        pageSize?: number;
        limit?: number;
      };

      const scopeTermId = req.termScope?.termId ?? null;
      res.json(
        await listFlags(
          { ...ctxOf(req), termId: scopeTermId },
          { scope, status, q, page, pageSize, limit },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/options",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const scopeTermId = req.termScope?.termId ?? null;
      res.json(await getFlagOptions(ctxOf(req), { termId: scopeTermId }));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", raiseSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        studentId: string;
        subjectId: string;
        sectionId: string;
        termId: string;
        reason: "wrong_score" | "missing_assessment" | "transmutation_error" | "late_submission" | "other";
        note?: string;
      };
      const flag = await raiseFlag(
        { ...ctxOf(req), termId: req.termScope?.termId ?? body.termId },
        {
          studentId: body.studentId,
          subjectId: body.subjectId,
          sectionId: body.sectionId,
          termId: body.termId,
          reason: body.reason,
          note: body.note,
        },
      );
      await invalidateTags(["teacher", "overview", "academics", "principal", "risk", "guidance"]);

      res.status(201).json(flag);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/resolve",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", resolveSchema),
  async (req, res, next) => {
    try {
      const updated = await resolveFlag(
        ctxOf(req),
        String(req.params.id),
        (req.body as { resolutionNote: string }).resolutionNote,
      );
      await invalidateTags(["teacher", "overview", "academics", "principal", "risk", "guidance"]);

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
