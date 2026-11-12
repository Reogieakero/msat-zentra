import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getInterventionInsights } from "../../services/guidance/insights.service.js";

const router = Router();

router.get(
  "/intervention-insights",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({
    tags: [CACHE_TAGS.guidance, CACHE_TAGS.interventions, CACHE_TAGS.overview],
    ttl: CACHE_TTLS.dashboard,
  }),
  etag(),
  async (req, res, next) => {
    try {
      const schoolYearId = req.termScope
        ? req.termScope.schoolYearId
        : ((
            await prisma.schoolYear.findFirst({
              where: { isActive: true },
              select: { id: true },
            })
          )?.id ?? null);
      const termId = await resolveActiveTermId(req);
      res.json(
        await getInterventionInsights({
          userId: req.user!.id,
          role: req.user!.role,
          termId,
          schoolYearId,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
