import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { guidanceAlertCasesQuerySchema } from "./guidance.schemas.js";
import { getAlertCases } from "../../services/guidance/alertCases.service.js";
import type { AlertCaseRisk, AlertCaseType } from "../../services/guidance/alertCases.service.js";

const router = Router();

/**
 * One board, one request: the alerts desk merges guidance referrals with the
 * live intervention cohort and pages the merged list server-side. Filters and
 * search are applied here too, so the client never loads the whole desk.
 */
router.get(
  "/alerts/cases",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("query", guidanceAlertCasesQuerySchema),
  cache({ tags: [CACHE_TAGS.guidance, CACHE_TAGS.referrals, CACHE_TAGS.interventions], ttl: CACHE_TTLS.list }),
  etag(),
  async (req, res, next) => {
    try {
      const query = req.query as Record<string, unknown>;
      const type: AlertCaseType =
        query.type === "ADM" || query.type === "Counseling" || query.type === "Intervention"
          ? (query.type as AlertCaseType)
          : "";
      const risk: AlertCaseRisk =
        query.risk === "High" || query.risk === "Moderate" || query.risk === "Low"
          ? (query.risk as AlertCaseRisk)
          : "";

      res.json(
        await getAlertCases(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId: req.termScope?.termId ?? null,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          {
            type,
            risk,
            q: typeof query.q === "string" ? query.q : "",
            page: Math.max(1, Number(query.page) || 1),
            pageSize: Math.max(1, Number(query.pageSize) || 15),
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
