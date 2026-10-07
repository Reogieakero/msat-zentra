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

function schoolYearOf(req: { termScope?: { schoolYearId: string } | null }) {
  return req.termScope?.schoolYearId ?? null;
}

// Sections for the session's active school year — id, name, and grade level.
// Powers the "Grades & sections" navigation card on the heatmap pages.
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

// Students in a section with their attendance for the session's active term.
// Strict per-day basis: present = days present in EVERY offered subject that
// weekday; late/excused/absent are day outcomes on the same basis, so the
// four counts always sum to school days. `session` is accepted but ignored on
// the strict path; it only applies to the legacy fallback when the section
// holds zero subject-era rows for the term.
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

// Sheet roster for one section (active term): registered profiles plus
// enlisted-but-unregistered roster rows (LRN-deduped), each with a live
// attendance rate. Authorized for every section the caller may take
// attendance for — advisory, assignments, and code-linked timetable slots —
// so claimed subject teachers resolve their section's students.
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

// Per-student attendance summary for one section (active term, all
// subjects): present/late/absent/excused counts plus the present rate.
// Authorized for every section the caller may serve — feeds the advisory
// attendance table.
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

// Per-student, per-subject present rates for one section (active term).
// Read-only matrix for advisory views: each student maps to one rate per
// subject (null when the subject has no records for them yet).
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
