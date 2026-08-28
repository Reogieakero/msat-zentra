import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getReports, type ReportScope } from "./reports.service.js";

const router = Router();

const SCOPES: ReportScope[] = ["school", "grade", "section"];

// Principal Reports & Analytics command center. Aggregates live data across
// academics, interventions, ADM, anecdotal, attendance, audit, and accounts.
// ?scope=school|grade|section (default school). For grade/section scope, pass
// ?gradeLevel=G7 or ?sectionId=<id>.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
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

      const payload = await getReports({ scope, gradeLevel, sectionId });
      res.json(payload);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
