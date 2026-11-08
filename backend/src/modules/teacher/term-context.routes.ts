import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { termContextConfirmSchema } from "./term-context.schemas.js";
import {
  acknowledgeTermContext,
  getTermContext,
} from "../../services/teacher/termContext.service.js";

const router = Router();

async function ctxOf(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: await resolveActiveTermId(req),
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

router.get(
  "/term-context",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  cache({
    ttl: CACHE_TTLS.dashboard,
    tags: [CACHE_TAGS.teacher, CACHE_TAGS.roster],
  }),
  etag(),
  async (req, res, next) => {
    try {
      res.json(await getTermContext(await ctxOf(req)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/term-context/confirm",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", termContextConfirmSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        kind: "roster" | "classes";
        fingerprint: string;
        sameAsPrevious: boolean;
      };
      res.json(await acknowledgeTermContext(await ctxOf(req), body));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
