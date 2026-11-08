import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { teacherLockGradesQuerySchema } from "./teacher.schemas.js";
import { getLockGrades, type LockGradesView } from "../../services/teacher/lockGrades.service.js";

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
  "/lock-grades",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("query", teacherLockGradesQuerySchema),
  cache({
    ttl: CACHE_TTLS.dashboard,
    tags: [CACHE_TAGS.teacher, CACHE_TAGS.grades],
  }),
  etag(),
  async (req, res, next) => {
    try {
      const view = (req.query.view ?? "classes") as LockGradesView;
      res.json(await getLockGrades(await ctxOf(req), view));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
