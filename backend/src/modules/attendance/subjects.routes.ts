import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { teachableSectionIds } from "../teacher/advisory.repository.js";
import { getOfferedSubjects, getSubjectDays } from "../../services/attendance/subjects.service.js";

const router = Router();

router.get(
  "/subjects",
  requireAuth,
  requireRole("principal", "adviser", "subject_teacher", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");

      let termId = typeof req.query.termId === "string" ? req.query.termId : undefined;
      if (!termId) {
        termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      }
      res.json(
        await getOfferedSubjects({
          teacherId: req.user!.id,
          callerRole: req.user!.role,
          sectionId,
          termId,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/subject-days",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const subjectId = typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
      if (!subjectId) throw new AppError(400, "MISSING_SUBJECT", "subjectId query required");
      const mineOnly = req.query.mine === "1";
      const termId = req.termScope?.termId ?? (await scopedTermRow(req))?.id;
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const allowed = await teachableSectionIds(
        teacherId,
        termId,
        req.termScope?.schoolYearId ?? null,
      );
      res.json(
        await getSubjectDays({
          sectionId,
          subjectId,
          mineOnly,
          termId,
          teacherId,
          allowed: allowed.includes(sectionId),
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
