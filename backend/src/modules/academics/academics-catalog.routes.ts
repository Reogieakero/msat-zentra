import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { gradeToNumber } from "../../lib/grades.js";
import { toCategoryLabel } from "./academics-shared.js";

const router = Router();

router.get(
  "/assign/school-years",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (_req, res, next) => {
    try {
      const years = await prisma.schoolYear.findMany({
        orderBy: { name: "desc" },
        select: { id: true, name: true, isActive: true },
      });
      res.json({ schoolYears: years });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/assign/subjects",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (_req, res, next) => {
    try {
      const subjects = await prisma.subject.findMany({
        orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      });
      res.json({
        subjects: subjects.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          gradeLevel: gradeToNumber(s.gradeLevel),
          category: toCategoryLabel(s.category),
          active: true,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/assign/sections",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (req, res, next) => {
    try {
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      const scopedYearId = requestedYearId ?? req.termScope?.schoolYearId ?? null;
      let targetYear: { id: string; name: string } | null = null;
      if (scopedYearId) {
        targetYear = await prisma.schoolYear.findUnique({
          where: { id: scopedYearId },
          select: { id: true, name: true },
        });
        if (!targetYear && requestedYearId) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
      }
      if (!targetYear) {
        targetYear = await prisma.schoolYear.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
        });
      }
      const schoolYearId = targetYear?.id ?? "__none__";

      const sections = await prisma.section.findMany({
        where: { schoolYearId },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { id: true, name: true } },
          teacherAssignments: {
            include: {
              subject: { select: { id: true, code: true, name: true } },
              teacher: { select: { id: true, fullName: true } },
              term: { select: { termNumber: true } },
            },
          },
        },
      });

      res.json({
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          gradeLevel: gradeToNumber(s.gradeLevel),
          schoolYear: s.schoolYear?.name ?? targetYear?.name ?? "",
          schoolYearId: s.schoolYearId,
          adviserId: s.adviserId ?? "",
          adviserName: s.adviser?.fullName ?? (s as { adviserLabel?: string | null }).adviserLabel ?? "",
          adviserLabel: (s as { adviserLabel?: string | null }).adviserLabel ?? "",
          adviserCode: (s as { adviserCode?: string | null }).adviserCode ?? "",
          assignments: s.teacherAssignments.map((a) => ({
            id: a.id,
            subjectId: a.subject.id,
            subjectCode: a.subject.code,
            subjectName: a.subject.name,
            teacherId: a.teacherId,
            teacherName: a.teacher.fullName,
            term: `Term ${a.term.termNumber}`,
          })),
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/assign/teachers",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (_req, res, next) => {
    try {
      const teachers = await prisma.user.findMany({
        where: { role: { in: ["subject_teacher", "adviser"] }, status: "active" },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      });
      res.json({ teachers: teachers.map((t) => ({ id: t.id, name: t.fullName })) });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/assign/terms",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (req, res, next) => {
    try {
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      const scopedYearId = requestedYearId ?? req.termScope?.schoolYearId ?? null;
      let targetYear: { id: string; name: string } | null = null;
      if (scopedYearId) {
        targetYear = await prisma.schoolYear.findUnique({
          where: { id: scopedYearId },
          select: { id: true, name: true },
        });
        if (!targetYear && requestedYearId) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
      }
      if (!targetYear) {
        targetYear = await prisma.schoolYear.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
        });
      }
      if (!targetYear) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "No school year found");

      let terms = await prisma.term.findMany({
        where: { schoolYearId: targetYear.id },
        orderBy: { termNumber: "asc" },
        select: { id: true, termNumber: true },
      });

      const have = new Set(terms.map((t) => t.termNumber));
      if (!have.has(1) || !have.has(2) || !have.has(3)) {
        await prisma.term.createMany({
          data: [1, 2, 3]
            .filter((n) => !have.has(n))
            .map((termNumber) => ({ schoolYearId: targetYear!.id, termNumber })),
          skipDuplicates: true,
        });
        await invalidateTags(["academics", "principal"]);
        terms = await prisma.term.findMany({
          where: { schoolYearId: targetYear.id },
          orderBy: { termNumber: "asc" },
          select: { id: true, termNumber: true },
        });
      }

      res.json({ schoolYearId: targetYear.id, terms });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/assign/assignments",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { sectionId, subjectId, teacherId, term } = req.body as {
        sectionId?: string;
        subjectId?: string;
        teacherId?: string;
        term?: string;
      };
      if (!sectionId || !subjectId || !teacherId || !term) {
        throw new AppError(
          400,
          "MISSING_FIELDS",
          "sectionId, subjectId, teacherId and term are required"
        );
      }

      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");

      const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

      const termRow = await prisma.term.findFirst({
        where: { schoolYearId: section.schoolYearId, termNumber: Number(term.replace(/\D/g, "")) },
        select: { id: true },
      });
      if (!termRow) throw new AppError(404, "TERM_NOT_FOUND", "Term not found for school year");

      const assignment = await prisma.teacherSubjectAssignment.create({
        data: { teacherId, subjectId, sectionId, termId: termRow.id },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
          term: { select: { termNumber: true } },
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "create",
        sourceTable: "teacher_subject_assignments",
        sourceId: assignment.id,
        reason: "Principal assigned teacher to section subject",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.status(201).json({
        id: assignment.id,
        subjectId: assignment.subject.id,
        subjectCode: assignment.subject.code,
        subjectName: assignment.subject.name,
        teacherId: assignment.teacherId,
        teacherName: assignment.teacher.fullName,
        term: `Term ${assignment.term.termNumber}`,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/assign/assignments/:id",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.teacherSubjectAssignment.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");

      await prisma.teacherSubjectAssignment.delete({ where: { id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "delete",
        sourceTable: "teacher_subject_assignments",
        sourceId: id,
        reason: "Principal removed teacher assignment",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json({ id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
