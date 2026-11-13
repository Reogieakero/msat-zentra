import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { prisma } from "../../lib/prisma.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getTeacherNavQueues } from "../../services/teacher/navCounts.service.js";
import { TEACHER_ROLES } from "./advisory.repository.js";

const router = Router();

/**
 * Adviser sidebar badge queues. Kept separate from every page payload so the
 * rail can poll a tiny `{id, v}` map instead of a full board — the dot means
 * "new or updated since you last opened that page".
 */
router.get(
  "/nav-counts",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  cache({
    tags: [
      CACHE_TAGS.teacher,
      CACHE_TAGS.referrals,
      CACHE_TAGS.interventions,
      CACHE_TAGS.risk,
      CACHE_TAGS.adm,
      CACHE_TAGS.anecdotal,
      CACHE_TAGS.sessions,
    ],
    // Must not outlive one poll: a cached row would leave the dot dark for a
    // whole interval after the case already changed. The realtime channel sets
    // `x-zentra-fresh`, which bypasses the read in the same tick as the write.
    ttl: CACHE_TTLS.counts,
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
      res.json(
        await getTeacherNavQueues({
          userId: req.user!.id,
          role: req.user!.role,
          termId: await resolveActiveTermId(req),
          schoolYearId,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
