import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache } from "../../lib/cache.js";
import { etag } from "../../lib/etag.js";
import { CACHE_TAGS, CACHE_TTLS } from "../../lib/cacheTags.js";
import { getReports, type ReportScope } from "./reports.service.js";

const router = Router();

const SCOPES: ReportScope[] = ["school", "grade", "section"];

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  // Heavy aggregation: 5-min cache + ReportSnapshot DB fallback inside service.
  validate(
    "query",
    z.object({
      scope: z.enum(["school", "grade", "section"]).optional(),
      gradeLevel: z.string().trim().max(20).optional(),
      sectionId: z.string().trim().max(120).optional(),
    }),
  ),
  cache({ ttl: CACHE_TTLS.semiStatic, tags: [CACHE_TAGS.reports, "principal"] }),
  etag(),
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
