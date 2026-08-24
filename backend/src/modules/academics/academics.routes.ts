import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getAcademicsSummary } from "./academics.service.js";

const router = Router();

// Principal academics KPIs (O4): section summaries, pass/fail by grade, honor roll.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const summary = await getAcademicsSummary();
      res.json(summary);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
