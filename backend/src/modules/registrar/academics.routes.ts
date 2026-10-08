import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { notifyAcademicsSelf } from "../../lib/notify.js";
import {
  GRADE_BAND_11_12,
} from "../registry/registry.repository.js";
import { REGISTRAR_IDENTITY } from "../../services/registry/registry.types.js";
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

const BAND = GRADE_BAND_11_12;
const TAGS = ["registrar", "registrar-academics", "academics"];
const WRITE_TAGS = ["registrar", "registrar-academics", "academics"];
const WRITE_TAGS_FULL = ["registrar", "registrar-academics", "registrar-overview", "academics", "overview", "principal"];

function ctxOf(req: { user?: { id: string; role: string } }) {
  return { userId: req.user!.id, role: req.user!.role, band: BAND };
}

function yearOf(req: { termScope?: { schoolYearId: string } | null }) {
  return req.termScope?.schoolYearId ?? null;
}

router.get(
  "/subjects",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await listSubjects(ctxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/overview",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await getAcademicsOverview(ctxOf(req)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/subjects",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const { code, name, gradeLevel, category } = req.body as {
        code?: string;
        name?: string;
        gradeLevel?: number;
        category?: string;
      };
      const subject = await createSubject(ctxOf(req), REGISTRAR_IDENTITY, {
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

router.patch(
  "/subjects/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name, category } = req.body as { name?: string; category?: string };
      const updated = await updateSubject(ctxOf(req), REGISTRAR_IDENTITY, id, { name, category });
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

router.get(
  "/school-years",
  requireAuth,
  requireRole("registrar", "record_keeper"),
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
  requireRole("registrar", "record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {

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

router.get(
  "/terms",
  requireAuth,
  requireRole("registrar", "record_keeper", "adm_coordinator"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {

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
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const { name, gradeLevel, schoolYear, adviserId } = req.body as {
        name?: string;
        gradeLevel?: number;
        schoolYear?: string;
        adviserId?: string;
      };
      const section = await createSection(ctxOf(req), REGISTRAR_IDENTITY, {
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
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name, adviserId } = req.body as { name?: string; adviserId?: string };
      const updated = await updateSection(ctxOf(req), REGISTRAR_IDENTITY, id, { name, adviserId });
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

router.get(
  "/teachers",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(await listTeacherLoads(BAND));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/teachers/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
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
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const { sectionId, subjectId, teacherId, term } = req.body as {
        sectionId?: string;
        subjectId?: string;
        teacherId?: string;
        term?: string;
      };
      const assignment = await createAssignment(ctxOf(req), REGISTRAR_IDENTITY, {
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
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const result = await deleteAssignment(ctxOf(req), REGISTRAR_IDENTITY, id);
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

router.get(
  "/subjects/:id/students",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: TAGS }),
  async (req, res, next) => {
    try {
      res.json(
        await getSubjectStudents({ band: BAND, subjectId: String(req.params.id), desk: REGISTRAR_IDENTITY }),
      );
    } catch (e) {
      next(e);
    }
  }
);

export default router;
