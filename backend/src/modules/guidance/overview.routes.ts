import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getOverview } from "../../services/guidance/overview.service.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: [CACHE_TAGS.guidance, CACHE_TAGS.overview], ttl: CACHE_TTLS.dashboard }),
  etag(),
  async (req, res, next) => {
    try {

      const schoolYearId = req.termScope
        ? req.termScope.schoolYearId
        : (await prisma.schoolYear.findFirst({
            where: { isActive: true },
            select: { id: true },
          }))?.id ?? null;
      const termId = await resolveActiveTermId(req);
      res.json(
        await getOverview({
          userId: req.user!.id,
          role: req.user!.role,
          termId,
          schoolYearId,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
