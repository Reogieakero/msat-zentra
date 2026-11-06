import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getLegacyDays } from "../../services/attendance/legacy.service.js";

const router = Router();

router.get(
  "/legacy/days",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const session = (req.query.session === "PM" ? "PM" : "AM") as "AM" | "PM";
      const limit = Math.min(
        Math.max(typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || 30 : 30, 1),
        200,
      );
      res.json(await getLegacyDays({ sectionId, session, limit }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
