import { Router } from "express";
import { GradeLevel } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";

const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

const router = Router();

function toGradeLevel(n: number): GradeLevel {
  if (n === 11) return "G11";
  if (n === 12) return "G12";
  throw new AppError(400, "INVALID_GRADE_LEVEL", "Grade level must be 11 or 12");
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

// List G11–G12 subjects with live enrollment / pass / fail counts derived from
// final grades. No mocked data.
router.get(
  "/subjects",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (_req, res, next) => {
    try {
      const subjects = await prisma.subject.findMany({
        where: { gradeLevel: { in: GRADE_BAND } },
        orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      });

      const result = await Promise.all(
        subjects.map(async (s) => {
          // enrolled = every student in the grade level (they all take the subject)
          const [enrolled, passed] = await Promise.all([
            prisma.studentProfile.count({ where: { gradeLevel: s.gradeLevel } }),
            prisma.finalGrade.count({
              where: { subjectId: s.id, remarks: "Passed" },
            }),
          ]);
          const failed = enrolled - passed;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            gradeLevel: s.gradeLevel === "G11" ? 11 : 12,
            active: true,
            enrolled,
            passed,
            failed,
          };
        })
      );

      res.json({ subjects: result });
    } catch (e) {
      next(e);
    }
  }
);

// Registrar "Sections & Subjects" landing overview. Returns the active school
// year + active term, and every in-band subject with its total enrollment and a
// per-section breakdown of that enrollment (for the grade-level filter + donut).
// The subjects "active for the term / school year" are the active school year's
// subjects (there is no per-term subject switch in this band).
router.get(
  "/overview",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (_req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { termNumber: true },
      });

      const subjects = await prisma.subject.findMany({
        where: { gradeLevel: { in: GRADE_BAND } },
        orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      });

      // Per-grade section breakdown so we only query each grade once.
      const enrollmentsByGrade = await Promise.all(
        GRADE_BAND.map(async (gl) => {
          const rows = await prisma.studentProfile.groupBy({
            by: ["sectionId"],
            where: { gradeLevel: gl },
            _count: { _all: true },
          });
          const sections = await prisma.section.findMany({
            where: { id: { in: rows.map((r) => r.sectionId).filter(Boolean) as string[] } },
            select: { id: true, name: true, gradeLevel: true },
          });
          const map = new Map(rows.map((r) => [r.sectionId, r._count._all]));
          return {
            gl,
            total: rows.reduce((s, r) => s + r._count._all, 0),
            sections: sections.map((sec) => ({
              id: sec.id,
              name: sec.name,
              count: map.get(sec.id) ?? 0,
            })),
          };
        }),
      );

      const byGrade = new Map(enrollmentsByGrade.map((e) => [e.gl, e]));

      const result = subjects.map((s) => {
        const grade = s.gradeLevel === "G11" ? 11 : 12;
        const e = byGrade.get(s.gradeLevel);
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          gradeLevel: grade,
          active: true,
          enrolled: e?.total ?? 0,
          enrollments: e?.sections ?? [],
        };
      });

      res.json({
        schoolYear: activeYear?.name ?? null,
        schoolYearId: activeYear?.id ?? null,
        term: activeTerm?.termNumber ?? null,
        subjects: result,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Create a G11–G12 subject.
router.post(
  "/subjects",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const { code, name, gradeLevel } = req.body as {
        code?: string;
        name?: string;
        gradeLevel?: number;
      };
      if (!code?.trim() || !name?.trim()) {
        throw new AppError(400, "MISSING_FIELDS", "Code and name are required");
      }
      const gl = toGradeLevel(Number(gradeLevel));

      const existing = await prisma.subject.findUnique({ where: { code: code.trim().toUpperCase() } });
      if (existing) {
        throw new AppError(409, "DUPLICATE_CODE", "Subject code already exists");
      }

      const subject = await prisma.subject.create({
        data: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          gradeLevel: gl,
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "create",
        sourceTable: "subjects",
        sourceId: subject.id,
        reason: "Registrar created subject",
      });
      await invalidateTags(["registrar", "academics", "overview", "principal"]);

      // "enrolled" reflects the students in this grade level who take the
      // subject — derived from student enrollment, not final-grade rows.
      const enrolled = await prisma.studentProfile.count({ where: { gradeLevel: gl } });

      res.status(201).json({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        gradeLevel: subject.gradeLevel === "G11" ? 11 : 12,
        active: true,
        enrolled,
        passed: 0,
        failed: 0,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Update a subject (name only; code is immutable identity, gradeLevel fixed).
router.patch(
  "/subjects/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name } = req.body as { name?: string };
      const existing = await prisma.subject.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

      const updated = await prisma.subject.update({
        where: { id },
        data: { name: name?.trim() ?? existing.name },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "subjects",
        sourceId: updated.id,
        reason: "Registrar updated subject",
      });
      await invalidateTags(["registrar", "academics"]);

      res.json({
        id: updated.id,
        code: updated.code,
        name: updated.name,
        gradeLevel: updated.gradeLevel === "G11" ? 11 : 12,
        active: true,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

router.get(
  "/sections",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (_req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      const schoolYearId = activeYear?.id ?? "__none__";

      const sections = await prisma.section.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, schoolYearId },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { name: true } },
          teacherAssignments: {
            include: {
              subject: { select: { id: true, code: true, name: true } },
              teacher: { select: { id: true, fullName: true } },
              term: { select: { termNumber: true } },
            },
          },
        },
      });

      const result = sections.map((s) => ({
        id: s.id,
        name: s.name,
        gradeLevel: s.gradeLevel === "G11" ? 11 : 12,
        schoolYear: s.schoolYear?.name ?? activeYear?.name ?? "",
        adviserId: s.adviserId ?? "",
        adviserName: s.adviser?.fullName ?? "",
        assignments: s.teacherAssignments.map((a) => ({
          id: a.id,
          subjectId: a.subject.id,
          subjectCode: a.subject.code,
          subjectName: a.subject.name,
          teacherId: a.teacherId,
          teacherName: a.teacher.fullName,
          term: `Term ${a.term.termNumber}`,
        })),
      }));

      res.json({ sections: result });
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
      if (!name?.trim()) throw new AppError(400, "MISSING_NAME", "Section name is required");
      const gl = toGradeLevel(Number(gradeLevel));

      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      if (!activeYear) throw new AppError(409, "NO_ACTIVE_YEAR", "No active school year");

      const yearName = schoolYear?.trim() || activeYear.name;
      const schoolYearRow =
        (await prisma.schoolYear.findFirst({ where: { name: yearName } })) ?? activeYear;

      if (adviserId) {
        const adv = await prisma.user.findUnique({ where: { id: adviserId } });
        if (!adv) throw new AppError(404, "ADVISER_NOT_FOUND", "Adviser not found");
      }

      const section = await prisma.section.create({
        data: {
          name: name.trim(),
          gradeLevel: gl,
          schoolYearId: schoolYearRow.id,
          adviserId: adviserId || null,
        },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { name: true } },
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "create",
        sourceTable: "sections",
        sourceId: section.id,
        reason: "Registrar created section",
      });
      await invalidateTags(["registrar", "academics", "overview", "principal"]);

      res.status(201).json({
        id: section.id,
        name: section.name,
        gradeLevel: section.gradeLevel === "G11" ? 11 : 12,
        schoolYear: section.schoolYear?.name ?? yearName,
        adviserId: section.adviserId ?? "",
        adviserName: section.adviser?.fullName ?? "",
        assignments: [],
      });
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
      const existing = await prisma.section.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");

      if (adviserId) {
        const adv = await prisma.user.findUnique({ where: { id: adviserId } });
        if (!adv) throw new AppError(404, "ADVISER_NOT_FOUND", "Adviser not found");
      }

      const updated = await prisma.section.update({
        where: { id },
        data: {
          name: name?.trim() ?? existing.name,
          adviserId: adviserId === undefined ? undefined : adviserId || null,
        },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { name: true } },
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "sections",
        sourceId: updated.id,
        reason: "Registrar updated section",
      });
      await invalidateTags(["registrar", "academics"]);

      res.json({
        id: updated.id,
        name: updated.name,
        gradeLevel: updated.gradeLevel === "G11" ? 11 : 12,
        schoolYear: updated.schoolYear?.name ?? "",
        adviserId: updated.adviserId ?? "",
        adviserName: updated.adviser?.fullName ?? "",
      });
    } catch (e) {
      next(e);
    }
  }
);

// ---------------------------------------------------------------------------
// Teacher assignments (assign a teacher to a subject within a section + term)
// ---------------------------------------------------------------------------

router.get(
  "/teachers",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (_req, res, next) => {
    try {
      const teachers = await prisma.user.findMany({
        where: {
          role: { in: ["subject_teacher", "adviser"] },
          status: "active",
        },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      });
      res.json({
        teachers: teachers.map((t) => ({ id: t.id, name: t.fullName })),
      });
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
      if (!sectionId || !subjectId || !teacherId || !term) {
        throw new AppError(
          400,
          "MISSING_FIELDS",
          "sectionId, subjectId, teacherId and term are required"
        );
      }

      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      if (!GRADE_BAND.includes(section.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Section is outside registrar grade band");
      }

      const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
      if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

      const termRow = await prisma.term.findFirst({
        where: { schoolYearId: section.schoolYearId, termNumber: Number(term.replace(/\D/g, "")) },
        select: { id: true },
      });
      if (!termRow) throw new AppError(404, "TERM_NOT_FOUND", "Term not found for school year");

      const assignment = await prisma.teacherSubjectAssignment.create({
        data: {
          teacherId,
          subjectId,
          sectionId,
          termId: termRow.id,
        },
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
        reason: "Registrar assigned teacher to section subject",
      });
      await invalidateTags(["registrar", "academics"]);

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
  "/assignments/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.teacherSubjectAssignment.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");

      const section = await prisma.section.findUnique({ where: { id: existing.sectionId } });
      if (section && !GRADE_BAND.includes(section.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Assignment is outside registrar grade band");
      }

      await prisma.teacherSubjectAssignment.delete({ where: { id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "delete",
        sourceTable: "teacher_subject_assignments",
        sourceId: id,
        reason: "Registrar removed teacher assignment",
      });
      await invalidateTags(["registrar", "academics"]);

      res.json({ id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

// Students in the subject's grade level. Every student in the grade level takes
// the subject, so this lists ALL of them — including those who do not yet have a
// final grade recorded. Live data; final grade / remarks are shown when present.
router.get(
  "/subjects/:id/students",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const subject = await prisma.subject.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, gradeLevel: true },
      });
      if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
      if (!GRADE_BAND.includes(subject.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Subject is outside registrar grade band");
      }

      const students = await prisma.studentProfile.findMany({
        where: { gradeLevel: subject.gradeLevel },
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true, status: true } },
          section: { select: { name: true } },
          finalGrades: {
            where: { subjectId: id },
            select: {
              transmutedGrade: true,
              remarks: true,
            },
          },
        },
        orderBy: { lrn: "asc" },
      });

      const result = students.map((s) => {
        const fg = s.finalGrades[0];
        const hasGrade = fg != null && fg.transmutedGrade != null;
        return {
          id: s.userId,
          lrn: s.lrn,
          name: s.user.fullName,
          gradeLevel: subject.gradeLevel === "G11" ? 11 : 12,
          section: s.section?.name ?? "—",
          finalGrade: hasGrade ? (fg!.transmutedGrade as number) : 0,
          remarks: hasGrade
            ? fg!.remarks === "Failed"
              ? "Failed"
              : "Passed"
            : ("No grade yet" as const),
          status:
            s.user.status === "active"
              ? "active"
              : s.user.status === "pending"
                ? "pending"
                : "suspended",
        };
      });

      res.json({
        subject: {
          id: subject.id,
          code: subject.code,
          name: subject.name,
          gradeLevel: subject.gradeLevel === "G11" ? 11 : 12,
        },
        students: result,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
