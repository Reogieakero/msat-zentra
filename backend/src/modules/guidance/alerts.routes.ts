import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { scopedYearId } from "../../lib/termScope.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import { getAlerts } from "../../services/guidance/alerts.service.js";

const router = Router();

// Guidance Counselor alerts: live system-flagged queue from the shared risk
// engine (academic < 75, attendance < 80%, >= 1 anecdotal this term).
// Status-only rows — student identity, level, tripped factors, referral and
// intervention state. No anecdotal write-up content ever leaves this endpoint.
router.get(
  "/alerts",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "alerts"] }),
  async (req, res, next) => {
    try {
      const level =
        req.query.level === "High" || req.query.level === "Moderate"
          ? (req.query.level as "High" | "Moderate")
          : null;
      const factor =
        req.query.factor === "academic" ||
        req.query.factor === "attendance" ||
        req.query.factor === "behavioral"
          ? (req.query.factor as "academic" | "attendance" | "behavioral")
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

      // Session's active year when carried; legacy lookup otherwise.
      const schoolYearId = req.termScope?.schoolYearId ?? (await scopedYearId(req));
      const termId = await resolveActiveTermId(req);
      res.json(
        await getAlerts(
          { userId: req.user!.id, role: req.user!.role, termId, schoolYearId },
          { level, factor, q, page, pageSize },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
