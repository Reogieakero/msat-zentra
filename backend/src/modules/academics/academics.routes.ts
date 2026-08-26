import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getAcademicsSummary } from "./academics.service.js";

const router = Router();

// Principal academics KPIs (O4): section summaries, pass/fail by grade, honor roll.
// ?mode=raw includes every graded row (locked or not); ?mode=final (default)
// restricts to locked/finalized grades only.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const mode = req.query.mode === "raw" ? "raw" : "final";
      const summary = await getAcademicsSummary(mode);
      res.json(summary);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
