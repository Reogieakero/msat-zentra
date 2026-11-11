import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getNavQueues } from "../../services/guidance/navCounts.service.js";

const router = Router();

/**
 * Sidebar badge queue ids. Kept separate from `/overview` so every guidance
 * page can poll a tiny payload instead of the full dashboard.
 */
router.get(
  "/nav-counts",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({
    tags: [CACHE_TAGS.guidance, CACHE_TAGS.referrals, CACHE_TAGS.interventions],
    // The sidebar dot polls this every 5s, so the entry must not outlive one
    // poll: a stale-while-cached row would leave the dot dark for up to a
    // poll interval after the case already changed. The fresh-realtime window
    // (`x-zentra-fresh`, set by the guidance channel) still bypasses the read,
    // which is what makes the dot flip in the same tick as the board.
    ttl: CACHE_TTLS.counts,
  }),
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
        await getNavQueues({
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
