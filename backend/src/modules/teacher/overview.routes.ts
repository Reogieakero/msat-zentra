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
      res.json(
        await getOverview(
          {
            userId: req.user!.id,
            role: req.user!.role,
            termId,
            schoolYearId: req.termScope?.schoolYearId ?? null,
          },
          scope,
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
