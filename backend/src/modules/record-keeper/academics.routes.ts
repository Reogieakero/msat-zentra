import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import {
  GRADE_BAND_7_10,
} from "../registry/registry.repository.js";
import { RECORD_KEEPER_IDENTITY } from "../../services/registry/registry.types.js";
import {
  createAssignment,
  createSection,
  createSubject,
  deleteAssignment,
  getAcademicsOverview,
  getSubjectStudents,
  getTeacherDetail,
  listSchoolYears,
  listSections,
  listSubjects,
  listTeacherLoads,
  listTerms,
  updateSection,
  updateSubject,
} from "../../services/registry/academics.service.js";

const router = Router();

// Fixed desk band: this mount always serves G7–G10.
const BAND = GRADE_BAND_7_10;
const TAGS = ["record-keeper", "academics"];
const WRITE_TAGS = ["record-keeper", "academics"];
const WRITE_TAGS_FULL = ["record-keeper", "academics", "overview"];

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role, band: BAND };
}

function yearOf(req: { termScope?: { schoolYearId: string } | null }) {
  return req.termScope?.schoolYearId ?? null;
}

// List G7–G10 subjects with live enrollment / pass / fail counts derived from
// final grades. No mocked data.
router.get(
  "/subjects",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await listSubjects(ctxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

// Record Keeper "Sections & Subjects" landing overview. Returns the active school
// year + active term, and every in-band subject with its total enrollment and a
// per-section breakdown of that enrollment (for the grade-level filter + donut).
// The subjects "active for the term / school year" are the active school year's
// subjects (there is no per-term subject switch in this band).
router.get(
  "/overview",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await getAcademicsOverview(ctxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

// Create a G7–G10 subject. Codes are unique per grade level, so the same
// code may exist in two grades as separate rows.
router.post(
  "/subjects",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const { code, name, gradeLevel, category } = req.body as {
        code?: string;
        name?: string;
        gradeLevel?: number;
        category?: string;
      };
      const subject = await createSubject(ctxOf(req), RECORD_KEEPER_IDENTITY, {
        code,
        name,
        gradeLevel,
        category,
      });
      await invalidateTags(WRITE_TAGS_FULL);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "subjects",
        verb: "created",
        label: `subject ${subject.name} (${subject.code})`,
        sourceId: subject.id,
      });

      res.status(201).json({ ...subject, passed: 0, failed: 0 });
    } catch (e) {
      next(e);
    }
  }
);

// Update a subject (name + category; code is immutable identity, gradeLevel fixed).
router.patch(
  "/subjects/:id",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name, category } = req.body as { name?: string; category?: string };
      const updated = await updateSubject(ctxOf(req), RECORD_KEEPER_IDENTITY, id, { name, category });
      await invalidateTags(WRITE_TAGS);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "subjects",
        verb: "updated",
        label: `subject ${updated.name} (${updated.code})`,
        sourceId: updated.id,
      });

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// School years (DB-driven; no hardcoded year lists on the client).
router.get(
  "/school-years",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (_req, res, next) => {
    try {
      res.json(await listSchoolYears());
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/sections",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      // Optional ?schoolYearId= lets callers list sections for any year.
      // Defaults to the session's active School Year — pages no longer ask.
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      res.json(
        await listSections({ schoolYearId: requestedYearId, termScopeYearId: yearOf(req) }, BAND),
      );
    } catch (e) {
      next(e);
    }
  }
);

// Terms for a school year, straight from the database — the Assign Subjects
// dialog populates its Term picker from here instead of a hardcoded list.
// Missing term rows (1–3) are backfilled so every year always offers Term 1–3.
router.get(
  "/terms",
  requireAuth,
  requireRole("record_keeper", "adm_coordinator"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      // Defaults to the session's active School Year — pages no longer ask.
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      const { backfilled, ...body } = await listTerms({
        schoolYearId: requestedYearId,
        termScopeYearId: yearOf(req),
      });
      if (backfilled) await invalidateTags(WRITE_TAGS);
      res.json(body);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/sections",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const { name, gradeLevel, schoolYear, adviserId } = req.body as {
        name?: string;
        gradeLevel?: number;
        schoolYear?: string;
        adviserId?: string;
      };
      const section = await createSection(ctxOf(req), RECORD_KEEPER_IDENTITY, {
        name,
        gradeLevel,
        schoolYear,
        adviserId,
      });
      await invalidateTags(WRITE_TAGS_FULL);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "sections",
        verb: "created",
        label: `section ${section.name}`,
        sourceId: section.id,
      });

      res.status(201).json({ ...section, assignments: [] });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/sections/:id",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name, adviserId } = req.body as { name?: string; adviserId?: string };
      const updated = await updateSection(ctxOf(req), RECORD_KEEPER_IDENTITY, id, { name, adviserId });
      await invalidateTags(WRITE_TAGS);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "sections",
        verb: "updated",
        label: `section ${updated.name}`,
        sourceId: updated.id,
      });

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Teacher assignments (assign a teacher to a subject within a section + term).
router.get(
  "/teachers",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await listTeacherLoads(BAND));
    } catch (e) {
      next(e);
    }
  }
);

// Single teacher with their full workload/assignment rows for the active
// school year within the record-keeper grade band. One row per section+term.
router.get(
  "/teachers/:id",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await getTeacherDetail(BAND, String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/assignments",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const { sectionId, subjectId, teacherId, term } = req.body as {
        sectionId?: string;
        subjectId?: string;
        teacherId?: string;
        term?: string;
      };
      const assignment = await createAssignment(ctxOf(req), RECORD_KEEPER_IDENTITY, {
        sectionId,
        subjectId,
        teacherId,
        term,
      });
      await invalidateTags(WRITE_TAGS);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "teacher_subject_assignments",
        verb: "assigned",
        label: `${assignment.teacherName} to ${assignment.subjectCode} (${assignment.term})`,
        sourceId: assignment.id,
      });

      res.status(201).json(assignment);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/assignments/:id",
  requireAuth,
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const result = await deleteAssignment(ctxOf(req), RECORD_KEEPER_IDENTITY, id);
      await invalidateTags(WRITE_TAGS);

      await notifyAcademicsSelf({
        userId: req.user!.id,
        sourceTable: "teacher_subject_assignments",
        verb: "removed",
        label: `a teacher assignment`,
        sourceId: id,
      });

      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Students in the subject's grade level. Every student in the grade level takes
// the subject, so this lists ALL of them — including enlisted students without
// accounts and those who do not yet have a final grade recorded. Live data;
// final grade / remarks are shown when present.
router.get(
  "/subjects/:id/students",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(
        await getSubjectStudents({ band: BAND, subjectId: String(req.params.id), desk: RECORD_KEEPER_IDENTITY }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
