import { Router } from "express";import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { teacherOverviewQuerySchema } from "./teacher.schemas.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getOverview } from "../../services/teacher/overview.service.js";
import { getStudentList } from "../../services/teacher/overview-students.service.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requireRole("subject_teacher", "adviser"),

  validate("query", teacherOverviewQuerySchema),
  cache({ ttl: CACHE_TTLS.dashboard, tags: [CACHE_TAGS.teacher, CACHE_TAGS.overview] }),
  etag(),
  async (req, res, next) => {
    try {

      const q = req.query as Record<string, unknown>;
      const scopeParam = q.scope;
      const scope =
        scopeParam === "critical" || scopeParam === "secondary" || scopeParam === "gradebook"
          ? scopeParam
          : "full";
      const termId = await resolveActiveTermId(req);
      const atRiskOnly = q.atRiskOnly === "1" || q.atRiskOnly === "true";
      const clampPage = (v: unknown) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const clampLimit = (v: unknown) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? Math.min(n, 15) : 0;
      };
      const classPage = clampPage(q.classPage);
      const classLimit = clampLimit(q.classLimit);
      const advisoryPage = clampPage(q.advisoryPage);
      const advisoryLimit = clampLimit(q.advisoryLimit);
      res.json(
        await getOverview(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          scope,
          {
            atRiskOnly,
            ...(classPage && classLimit ? { classPage, classLimit } : {}),
            ...(advisoryPage && advisoryLimit ? { advisoryPage, advisoryLimit } : {}),
          },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/overview/student-list",
  requireAuth,
  requireRole("subject_teacher", "adviser"),

  cache({ ttl: CACHE_TTLS.dashboard, tags: [CACHE_TAGS.teacher, CACHE_TAGS.overview] }),
  etag(),
  async (req, res, next) => {
    try {
      const classIdParam = String(req.query.classId ?? "").trim();
      const advisorySectionParam = String(req.query.advisorySectionId ?? "").trim();
      const termId = await resolveActiveTermId(req);
      res.json(
        await getStudentList(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          { classId: classIdParam, advisorySectionId: advisorySectionParam },
        ),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
