import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { guidanceAlertsQuerySchema } from "./guidance.schemas.js";
import { scopedYearId } from "../../lib/termScope.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { resolveGuidancePageSize } from "./guidance.repository.js";
import { getAlerts } from "../../services/guidance/alerts.service.js";

const router = Router();

router.get(
  "/alerts",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("query", guidanceAlertsQuerySchema),
  cache({ tags: [CACHE_TAGS.guidance, "alerts"], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const level = query.level === "High" || query.level === "Moderate" ? query.level : null;
      const factor =
        query.factor === "academic" || query.factor === "attendance" || query.factor === "behavioral"
          ? query.factor
          : null;
      const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = resolveGuidancePageSize(req);

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
