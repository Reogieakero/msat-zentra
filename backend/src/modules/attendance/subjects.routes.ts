import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { scopedTermRow } from "../../lib/termScope.js";
import { teachableSectionIds } from "../teacher/advisory.routes.js";
import { getOfferedSubjects, getSubjectDays } from "../../services/attendance/subjects.service.js";

const router = Router();

// Offered subjects for a section+term (assignment-backed) with the caller's
// mark permission. Powers the teacher subject selector — the ONLY source of
// valid subjectId values for POST /bulk.
router.get(
  "/subjects",
  requireAuth,
  requireRole("principal", "adviser", "subject_teacher", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");

      // Default to the session's active term — the client always sends it.
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

// Per-student, per-day subject marks for the active term plus the term
// range — feeds the meetup blocks view (one heatblock per scheduled meetup
// day of the subject, term-scoped). Authorized for every section the caller
// may serve (advisory, assignments, code-linked timetable slots).
// ?mine=1 restricts rows to takes the caller recorded themselves, so a
// teacher's workspace rate matches what the advisory matrix attributes.
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
