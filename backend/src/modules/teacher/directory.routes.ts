import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { claimCodeSchema, verifyCodeSchema } from "./teacher.schemas.js";
import {
  claimCode,
  enterTermGrant,
  getMyLink,
  leaveTerm,
  listTeachers,
  verifyAttendance,
} from "../../services/teacher/directory.service.js";

const router = Router();

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
  "/schedule/teachers",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (_req, res, next) => {
    try {
      res.json(await listTeachers());
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/schedule/teachers/me",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      res.json(await getMyLink(ctxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/schedule/teachers/term-grant",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const result = await enterTermGrant(ctxOf(req));
      await invalidateTags(["teacher", "schedule"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/schedule/teachers/claim",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", claimCodeSchema),
  async (req, res, next) => {
    try {
      const result = await claimCode(ctxOf(req), (req.body as { code?: string }).code ?? "");
      await invalidateTags(["teacher", "schedule"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/schedule/teachers/verify-attendance",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", verifyCodeSchema),
  async (req, res, next) => {
    try {
      const result = await verifyAttendance(ctxOf(req), (req.body as { code?: string }).code ?? "");
      await invalidateTags(["teacher", "schedule"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/schedule/teachers/me",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const result = await leaveTerm(ctxOf(req));
      await invalidateTags(["teacher", "schedule"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
