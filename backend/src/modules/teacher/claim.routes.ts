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

// GET /api/teacher/advisory/claim-status — first-login self-onboarding.
// Returns sections the teacher already advises plus every unclaimed section
// (adviserId null) in the session's active school year. Name matches against
// the principal's free-text label are flagged `suggested` and sorted first,
// but every unclaimed section is listed — the listed name is sometimes
// misspelled, so it never gates the list. Sections the principal assigned
// carry `hasCode: true` (the code value itself is never exposed here) and
// require that code on POST /claim; truly empty sections (no label, no code)
// stay claimable without one for back-compat.
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

// POST /api/teacher/advisory/claim { sectionId, code? } — link the teacher's
// account as the section adviser. Guards: section must be in the session's
// school year and currently unclaimed. Sections the principal assigned
// (adviserLabel present) require their advisory code — the code is the
// verification that the claimant is the listed teacher. Truly empty sections
// (no label, no code) stay claimable without one for back-compat. The write
// itself is a conditional updateMany (adviserId still null + code still
// matching) so two teachers racing the same section resolve to exactly one
// winner (409 for the loser); the code is consumed (cleared) on success so it
// cannot be replayed.
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

// DELETE /api/teacher/advisory/claim { sectionId? } — release the teacher's
// advisory section(s). With sectionId, releases only that section when owned;
// without it, releases every section this teacher advises (answering "Are you
// an adviser?" with No in Settings). Conditional writes so a section already
// taken over by someone else is never touched.
router.delete(
  "/claim",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const bodyId = ((req.body ?? {}) as { sectionId?: string }).sectionId;
      const queryId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const { sectionId } = { sectionId: bodyId ?? queryId };
      // Year-scoped: releasing answers "Are you an adviser?" for the session
      // year only — other years' adviserships are never touched.
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
