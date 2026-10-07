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

// Teaching staff options for the slot overlay: plain display names the
// master types once and picks forever. No accounts involved.
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

// The catalog row the signed-in teacher linked with their code (if any),
// plus this term's verification grant. The link is identity (global); the
// grant is per term — a Term 1 unlock never opens another term.
// Masters bypass code gates on My Classes / Attendance, so the flag rides
// along here too.
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

// Per-term entry for advisers: answering "continue as adviser for this term"
// records the term grant in the DB (the auth verification flow per term).
// Subject teachers enter their code instead (claim + verify-attendance).
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

// Link the teacher's login to their teacher-list row by entering its code.
// One login holds one row; one row holds one login.
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

// Verify the attendance code: the entered code must match the teacher's
// schedule link code (same code re-entered per term unlocks that term).
// The unlock lands on this term's grant row — never the global link row —
// so Term 1 can never open another term. On match both the teacher and
// every active Master Teacher get a realtime bell row (toast + badge,
// no refresh).
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

// Leave the active term (per-term): drops ONLY this term's grant row.
// The catalog link and every other term's grants stay intact — leaving
// Term 1 never affects Term 2, because access is scoped by term, not by
// school year. No master fanout: the link itself is unchanged, so there is
// nothing for the teacher list to react to.
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
