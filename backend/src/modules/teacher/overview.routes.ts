import { Router } from "express";import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { getOverview } from "../../services/teacher/overview.service.js";
import { getStudentList } from "../../services/teacher/overview-students.service.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requireRole("subject_teacher", "adviser"),

  cache({ ttl: 300, tags: ["teacher", "overview"] }),
  async (req, res, next) => {
    try {

      const scopeParam = req.query.scope;
      const scope =
        scopeParam === "critical" || scopeParam === "secondary" || scopeParam === "gradebook"
          ? scopeParam
          : "full";
      const termId = await resolveActiveTermId(req);
      const atRiskOnly = req.query.atRiskOnly === "1" || req.query.atRiskOnly === "true";
      const clampPage = (v: unknown) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const clampLimit = (v: unknown) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0;
      };
      const classPage = clampPage(req.query.classPage);
      const classLimit = clampLimit(req.query.classLimit);
      const advisoryPage = clampPage(req.query.advisoryPage);
      const advisoryLimit = clampLimit(req.query.advisoryLimit);
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

  cache({ ttl: 300, tags: ["teacher", "overview"] }),
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
