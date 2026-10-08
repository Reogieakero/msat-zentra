import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import { getReports, type ReportScope } from "./reports.service.js";

const router = Router();

const SCOPES: ReportScope[] = ["school", "grade", "section"];

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["reports", "principal"] }),
  async (req, res, next) => {
    try {
      const scopeParam = typeof req.query.scope === "string" ? req.query.scope : "school";
      const scope: ReportScope = SCOPES.includes(scopeParam as ReportScope)
        ? (scopeParam as ReportScope)
        : "school";
      const gradeLevel =
        typeof req.query.gradeLevel === "string" ? req.query.gradeLevel : undefined;
      const sectionId =
        typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;

      const payload = await getReports({
        scope,
        gradeLevel,
        sectionId,
        schoolYearId: req.termScope?.schoolYearId ?? null,
        termId: req.termScope?.termId ?? null,
      });
      res.json(payload);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
