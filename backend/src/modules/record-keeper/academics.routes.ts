import { Router } from "express";
import { GradeLevel } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";

const router = Router();

const GRADE_BAND_7_10: GradeLevel[] = ["G7", "G8", "G9", "G10"];

function gradeToNumber(gradeLevel: GradeLevel): 7 | 8 | 9 | 10 {
  if (gradeLevel === "G7") return 7;
  if (gradeLevel === "G8") return 8;
  if (gradeLevel === "G9") return 9;
  return 10;
}

function toGradeLevel(n: number): GradeLevel {
  if (n === 7) return "G7";
  if (n === 8) return "G8";
  if (n === 9) return "G9";
  if (n === 10) return "G10";
  throw new AppError(400, "INVALID_GRADE_LEVEL", "Grade level must be 7, 8, 9, or 10");
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

router.get(
  "/subjects",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
  async (_req, res, next) => {
    try {
      const subjects = await prisma.subject.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 } },
        orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      });

      const result = await Promise.all(
        subjects.map(async (s) => {
          const enrolled = await prisma.studentProfile.count({ where: { gradeLevel: s.gradeLevel } });
          const passed = await prisma.finalGrade.count({
            where: { subjectId: s.id, remarks: "Passed" },
          });
          const failed = enrolled - passed;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            gradeLevel: gradeToNumber(s.gradeLevel),
            active: true,
            enrolled,
            passed,
            failed,
          };
        }),
      );

      res.json({ subjects: result });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/overview",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
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
        where: { gradeLevel: { in: GRADE_BAND_7_10 } },
        orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
      });

      const enrollmentsByGrade = await Promise.all(
        GRADE_BAND_7_10.map(async (gl) => {
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
        const grade = gradeToNumber(s.gradeLevel);
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

router.post(
  "/subjects",
  requireAuth,
  requireRole("record_keeper"),
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
        reason: "Record keeper created subject",
      });
      await invalidateTags(["record-keeper", "academics", "overview"]);

      const enrolled = await prisma.studentProfile.count({ where: { gradeLevel: gl } });

      res.status(201).json({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        gradeLevel: gradeToNumber(subject.gradeLevel),
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

router.patch(
  "/subjects/:id",
  requireAuth,
  requireRole("record_keeper"),
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
        reason: "Record keeper updated subject",
      });
      await invalidateTags(["record-keeper", "academics"]);

      res.json({
        id: updated.id,
        code: updated.code,
        name: updated.name,
        gradeLevel: gradeToNumber(updated.gradeLevel),
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
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
  async (_req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      const schoolYearId = activeYear?.id ?? "__none__";

      const sections = await prisma.section.findMany({
        where: { gradeLevel: { in: GRADE_BAND_7_10 }, schoolYearId },
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
        gradeLevel: gradeToNumber(s.gradeLevel),
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
  requireRole("record_keeper"),
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
        reason: "Record keeper created section",
      });
      await invalidateTags(["record-keeper", "academics", "overview"]);

      res.status(201).json({
        id: section.id,
        name: section.name,
        gradeLevel: gradeToNumber(section.gradeLevel),
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
  requireRole("record_keeper"),
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
        reason: "Record keeper updated section",
      });
      await invalidateTags(["record-keeper", "academics"]);

      res.json({
        id: updated.id,
        name: updated.name,
        gradeLevel: gradeToNumber(updated.gradeLevel),
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
// Teacher assignments
// ---------------------------------------------------------------------------

router.get(
  "/teachers",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
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

      const loads = await prisma.teacherSubjectAssignment.findMany({
        where: {
          section: { schoolYear: { isActive: true }, gradeLevel: { in: GRADE_BAND_7_10 } },
        },
        select: {
          teacherId: true,
          subjectId: true,
          subject: { select: { code: true, name: true, gradeLevel: true } },
          section: { select: { id: true, name: true } },
          term: { select: { termNumber: true } },
        },
        orderBy: [{ subject: { code: "asc" } }, { section: { name: "asc" } }],
      });

      const byTeacher = new Map<
        string,
        Map<string, { subjectId: string; code: string; name: string; gradeLevel: number; sections: string[]; terms: number[] }>
      >();
      for (const l of loads) {
        const subjectKey = l.subjectId;
        let subjectMap = byTeacher.get(l.teacherId);
        if (!subjectMap) {
          subjectMap = new Map();
          byTeacher.set(l.teacherId, subjectMap);
        }
        const grade = gradeToNumber(l.subject.gradeLevel);
        let entry = subjectMap.get(subjectKey);
        if (!entry) {
          entry = {
            subjectId: l.subjectId,
            code: l.subject.code,
            name: l.subject.name,
            gradeLevel: grade,
            sections: [],
            terms: [],
          };
          subjectMap.set(subjectKey, entry);
        }
        if (!entry.sections.includes(l.section.name)) entry.sections.push(l.section.name);
        if (!entry.terms.includes(l.term.termNumber)) entry.terms.push(l.term.termNumber);
      }

      res.json({
        teachers: teachers.map((t) => ({
          id: t.id,
          name: t.fullName,
          loads: Array.from((byTeacher.get(t.id) ?? new Map()).values()),
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/teachers/:id",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
  async (req, res, next) => {
    try {
      const userId = String(req.params.id);
      const teacher = await prisma.user.findFirst({
        where: { id: userId, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
        select: { id: true, fullName: true },
      });
      if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

      const advisory = await prisma.section.findMany({
        where: {
          adviserId: userId,
          schoolYear: { isActive: true },
          gradeLevel: { in: GRADE_BAND_7_10 },
        },
        select: { id: true, name: true, gradeLevel: true },
        orderBy: { name: "asc" },
      });

      const assignments = await prisma.teacherSubjectAssignment.findMany({
        where: {
          teacherId: userId,
          section: { schoolYear: { isActive: true }, gradeLevel: { in: GRADE_BAND_7_10 } },
        },
        select: {
          id: true,
          subjectId: true,
          subject: { select: { code: true, name: true, gradeLevel: true } },
          section: { select: { id: true, name: true } },
          term: { select: { termNumber: true } },
        },
        orderBy: [{ subject: { code: "asc" } }, { section: { name: "asc" } }, { term: { termNumber: "asc" } }],
      });

      res.json({
        teacher: {
          id: teacher.id,
          name: teacher.fullName,
          adviser: advisory.map((s) => ({
            id: s.id,
            name: s.name,
            gradeLevel: gradeToNumber(s.gradeLevel),
          })),
          assignments: assignments.map((a) => ({
            id: a.id,
            subjectId: a.subjectId,
            code: a.subject.code,
            name: a.subject.name,
            gradeLevel: gradeToNumber(a.subject.gradeLevel),
            section: a.section.name,
            sectionId: a.section.id,
            term: a.term.termNumber,
          })),
        },
      });
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
      if (!sectionId || !subjectId || !teacherId || !term) {
        throw new AppError(400, "MISSING_FIELDS", "sectionId, subjectId, teacherId and term are required");
      }

      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      if (!GRADE_BAND_7_10.includes(section.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Section is outside record-keeper grade band");
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
        reason: "Record keeper assigned teacher to section subject",
      });
      await invalidateTags(["record-keeper", "academics"]);

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
  requireRole("record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.teacherSubjectAssignment.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");

      const section = await prisma.section.findUnique({ where: { id: existing.sectionId } });
      if (section && !GRADE_BAND_7_10.includes(section.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Assignment is outside record-keeper grade band");
      }

      await prisma.teacherSubjectAssignment.delete({ where: { id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "delete",
        sourceTable: "teacher_subject_assignments",
        sourceId: id,
        reason: "Record keeper removed teacher assignment",
      });
      await invalidateTags(["record-keeper", "academics"]);

      res.json({ id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

// Students in the subject's grade level (G7–10). Every student in the grade level
// takes the subject, so this lists ALL of them.
router.get(
  "/subjects/:id/students",
  requireAuth,
  requireRole("record_keeper"),
  cache({ tags: ["record-keeper", "academics"] }),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const subject = await prisma.subject.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, gradeLevel: true },
      });
      if (!subject) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
      if (!GRADE_BAND_7_10.includes(subject.gradeLevel)) {
        throw new AppError(403, "BAND_SCOPE", "Subject is outside record-keeper grade band");
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
          gradeLevel: gradeToNumber(subject.gradeLevel),
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
          gradeLevel: gradeToNumber(subject.gradeLevel),
        },
        students: result,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
