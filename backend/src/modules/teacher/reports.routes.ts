import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getTeacherReports } from "../../services/teacher/reports.service.js";

const router = Router();

router.get(
  "/reports",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  // Term-scoped aggregation: 5-min cache, invalidated by teacher/grades/
  // attendance/anecdotal/referral writes via the shared cache tags.
  cache({ ttl: CACHE_TTLS.semiStatic, tags: [CACHE_TAGS.teacher, CACHE_TAGS.reports] }),
  etag(),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      res.json(
        await getTeacherReports({
          userId: req.user!.id,
          role: req.user!.role,
          termId,
          schoolYearId: req.termScope?.schoolYearId ?? null,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
