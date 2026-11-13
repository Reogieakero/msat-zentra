import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getNurseNavQueues } from "../../services/nurse/navCounts.service.js";

const router = Router();

/**
 * Nurse sidebar badge queues. Kept separate from every page payload so the
 * rail can poll a tiny `{id, v}` map instead of the full board — the dot means
 * "new or updated since you last opened that page".
 */
router.get(
  "/nav-counts",
  requireAuth,
  requireRole("nurse"),
  cache({
    tags: [CACHE_TAGS.nurse, CACHE_TAGS.referrals, CACHE_TAGS.notifications, CACHE_TAGS.risk],
    // Must not outlive one poll: a cached row would leave the dot dark for a
    // whole interval after the case already changed. The realtime channel sets
    // `x-zentra-fresh`, which bypasses the read in the same tick as the write.
    ttl: CACHE_TTLS.counts,
  }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(
        await getNurseNavQueues({
          userId: req.user!.id,
          termId: await resolveActiveTermId(req),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
