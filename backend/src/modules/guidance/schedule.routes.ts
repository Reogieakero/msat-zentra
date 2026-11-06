import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getDaySchedule } from "../../services/guidance/schedule.service.js";

const router = Router();

router.get(
  "/schedule",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const dateKey =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      const scopeTermId = req.termScope?.termId ?? null;
      res.json(
        await getDaySchedule(
          { userId: req.user!.id, role: req.user!.role, termId: scopeTermId, schoolYearId: null },
          dateKey,
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
