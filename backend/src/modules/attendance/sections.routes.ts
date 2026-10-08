import { Router, type Request } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { scopedTermRow, scopedYearId } from "../../lib/termScope.js";
import { teachableSectionIds } from "../teacher/advisory.repository.js";
import {
  getSectionRoster,
  getSectionStudents,
  getSectionSubjectMatrix,
  getSectionSummary,
  listSections,
} from "../../services/attendance/sections.service.js";

const router = Router();

router.get(
  "/sections",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const yearId = await scopedYearId(req);
      res.json(await listSections(yearId));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/sections/:id/students",
  requireAuth,
  requireRole("principal", "adviser", "guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const sectionId = String(req.params.id);
      const session = (req.query.session === "PM" ? "PM" : "AM") as "AM" | "PM";
      const activeTerm = await scopedTermRow(req);
      res.json(
        await getSectionStudents({
          sectionId,
          session,
          termId: activeTerm?.id,
          startDate: activeTerm?.startDate ?? undefined,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

async function teachableScope(req: Request, sectionId: string) {
  const teacherId = req.user!.id;
  const q = req.query as Record<string, unknown>;
  const queryTermId = typeof q.termId === "string" ? q.termId : undefined;
  const termId = queryTermId ?? req.termScope?.termId ?? (await scopedTermRow(req))?.id;
  if (!termId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
  }
  const allowed = await teachableSectionIds(
    teacherId,
    termId,
    req.termScope?.schoolYearId ?? null,
  );
  return { termId, allowed: allowed.includes(sectionId) };
}

function requireSectionId(req: { query: unknown }) {
  const sectionId =
    typeof (req.query as Record<string, unknown>).sectionId === "string"
      ? ((req.query as Record<string, unknown>).sectionId as string)
      : undefined;
  if (!sectionId) throw new AppError(400, "MISSING_SECTION", "sectionId query required");
  return sectionId;
}

router.get(
  "/section-roster",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const sectionId = requireSectionId(req);
      const scope = await teachableScope(req, sectionId);
      res.json(await getSectionRoster(sectionId, scope.termId, scope.allowed));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/section-summary",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const sectionId = requireSectionId(req);
      const scope = await teachableScope(req, sectionId);
      res.json(await getSectionSummary(sectionId, scope.termId, scope.allowed));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/section-subject-matrix",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const sectionId = requireSectionId(req);
      const scope = await teachableScope(req, sectionId);
      res.json(
        await getSectionSubjectMatrix({
          sectionId,
          termId: scope.termId,
          allowed: scope.allowed,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
