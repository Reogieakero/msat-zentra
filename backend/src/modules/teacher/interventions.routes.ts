import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import type { AdvisoryContext } from "../../services/advisory/advisory.types.js";
import { TEACHER_ROLES } from "./advisory.repository.js";
import { advisoryInterventionsQuerySchema } from "./advisory-interventions.schemas.js";
import {
  listAdvisoryInterventions,
  type AdvisoryInterventionsQuery,
} from "../../services/teacher/interventions.service.js";

const router = Router();

async function ctxOf(req: Request): Promise<AdvisoryContext> {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: await resolveActiveTermId(req),
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

/**
 * Adviser monitoring desk: every intervention + flagged advisee in the
 * teacher's own advisory section(s), current term only, read-only.
 */
router.get(
  "/interventions",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", advisoryInterventionsQuerySchema),
  cache({ tags: [CACHE_TAGS.teacher, CACHE_TAGS.interventions], ttl: CACHE_TTLS.dashboard }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(
        await listAdvisoryInterventions(
          await ctxOf(req),
          req.query as unknown as AdvisoryInterventionsQuery,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
