import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { scopedYearId } from "../../lib/termScope.js";
import { invalidateTags } from "../../lib/cache.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import {
  claimSection,
  getClaimStatus,
  releaseClaim,
} from "../../services/advisory/claim.service.js";

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
  "/claim-status",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const yearId = await scopedYearId(req);
      res.json(await getClaimStatus(ctxOf(req), yearId));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/claim",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const { sectionId, code } = req.body as { sectionId?: string; code?: string };
      const yearId = await scopedYearId(req);
      const result = await claimSection(ctxOf(req), { sectionId: sectionId ?? "", code }, yearId);
      await invalidateTags(["academics", "principal", "registrar", "overview", "teacher"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/claim",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const bodyId = ((req.body ?? {}) as { sectionId?: string }).sectionId;
      const queryId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const { sectionId } = { sectionId: bodyId ?? queryId };

      const yearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const result = await releaseClaim(ctxOf(req), { sectionId: sectionId ?? null }, yearId);
      await invalidateTags(["academics", "principal", "registrar", "overview", "teacher"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
