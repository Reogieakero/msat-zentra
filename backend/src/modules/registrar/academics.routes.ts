import { Router } from "express";
import { GradeLevel } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { rosterCountsByGrade, rosterCountsBySection } from "../../services/enrollment.js";
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

type SubjectCategoryLabel = "Core" | "Elective";

function toCategoryLabel(category: string): SubjectCategoryLabel {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

// Accepts "Core"/"Elective" (any casing); defaults to CORE when omitted.
function parseCategory(raw: unknown): "CORE" | "ELECTIVE" {
  if (raw == null || String(raw).trim() === "") return "CORE";
  const norm = String(raw).trim().toLowerCase();
  if (norm === "core") return "CORE";
  if (norm === "elective") return "ELECTIVE";
  throw new AppError(400, "INVALID_CATEGORY", "Category must be Core or Elective");
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

      // Roster-aware enrollment: registered profiles plus enlisted roster
      // students with no account yet (they count regardless of account
      // status). Failed counts only explicit Failed remarks so ungraded
      // students are never misreported as failed.
      const rosterByGrade = await rosterCountsByGrade([...GRADE_BAND]);
      const result = await Promise.all(
        subjects.map(async (s) => {
          // enrolled = every student in the grade level (they all take the subject)
          const [profiles, passed, failed] = await Promise.all([
            prisma.studentProfile.count({ where: { gradeLevel: s.gradeLevel } }),
            prisma.finalGrade.count({
              where: { subjectId: s.id, remarks: "Passed" },
            }),
            prisma.finalGrade.count({
              where: { subjectId: s.id, remarks: "Failed" },
            }),
          ]);
          const enrolled = profiles + (rosterByGrade.get(s.gradeLevel) ?? 0);
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            gradeLevel: s.gradeLevel === "G11" ? 11 : 12,
            category: toCategoryLabel(s.category),
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
      // Roster-aware: enlisted students without accounts count too, including
      // sections that currently hold only roster students.
      const enrollmentsByGrade = await Promise.all(
        GRADE_BAND.map(async (gl) => {
          const [rows, yearSections] = await Promise.all([
            prisma.studentProfile.groupBy({
              by: ["sectionId"],
              where: { gradeLevel: gl },
              _count: { _all: true },
            }),
            prisma.section.findMany({
              where: { gradeLevel: gl, schoolYear: { isActive: true } },
              select: { id: true },
            }),
          ]);
          const sectionIds = Array.from(
            new Set([
              ...rows.map((r) => r.sectionId).filter(Boolean),
              ...yearSections.map((s) => s.id),
            ]),
          ) as string[];
          const [sections, rosterCounts] = await Promise.all([
            prisma.section.findMany({
              where: { id: { in: sectionIds } },
              select: { id: true, name: true, gradeLevel: true },
            }),
            rosterCountsBySection(sectionIds),
          ]);
          const map = new Map(rows.map((r) => [r.sectionId, r._count._all]));
          const total =
            rows.reduce((s, r) => s + r._count._all, 0) +
            Array.from(rosterCounts.values()).reduce((s, n) => s + n, 0);
          return {
            gl,
            total,
            sections: sections.map((sec) => ({
              id: sec.id,
              name: sec.name,
              count: (map.get(sec.id) ?? 0) + (rosterCounts.get(sec.id) ?? 0),
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
          category: toCategoryLabel(s.category),
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

// Create a G11–G12 subject. Codes are unique per grade level, so the same
// code may exist in both Grade 11 and Grade 12 as separate rows.
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
      if (!code?.trim() || !name?.trim()) {
        throw new AppError(400, "MISSING_FIELDS", "Code and name are required");
      }
      const gl = toGradeLevel(Number(gradeLevel));
      const cat = parseCategory(category);

      const normalizedCode = code.trim().toUpperCase();
      const existing = await prisma.subject.findFirst({
        where: { code: normalizedCode, gradeLevel: gl },
      });
      if (existing) {
        throw new AppError(
          409,
          "DUPLICATE_CODE",
          `Subject code already exists for Grade ${gl === "G11" ? 11 : 12}`
        );
      }

      const subject = await prisma.subject.create({
        data: {
          code: normalizedCode,
          name: name.trim(),
          gradeLevel: gl,
          category: cat,
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
      // Roster-enlisted students without accounts count too.
      const [profiles, rosterByGrade] = await Promise.all([
        prisma.studentProfile.count({ where: { gradeLevel: gl } }),
        rosterCountsByGrade([gl]),
      ]);
      const enrolled = profiles + (rosterByGrade.get(gl) ?? 0);

      res.status(201).json({
        id: subject.id,
        code: subject.code,
        name: subject.name,
        gradeLevel: subject.gradeLevel === "G11" ? 11 : 12,
        category: toCategoryLabel(subject.category),
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

// Update a subject (name + category; code is immutable identity, gradeLevel fixed).
router.patch(
  "/subjects/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { name, category } = req.body as { name?: string; category?: string };
      const existing = await prisma.subject.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");

      const updated = await prisma.subject.update({
        where: { id },
        data: {
          name: name?.trim() ? name.trim() : existing.name,
          category: category === undefined ? existing.category : parseCategory(category),
        },
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
        category: toCategoryLabel(updated.category),
        active: true,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ---------------------------------------------------------------------------
// School years (DB-driven; no hardcoded year lists on the client)
// ---------------------------------------------------------------------------

router.get(
  "/school-years",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
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

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

router.get(
  "/sections",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (req, res, next) => {
    try {
      // Optional ?schoolYearId= lets callers (e.g. Assign Subjects) list
      // sections for any year. Defaults to the active year.
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      let targetYear: { id: string; name: string } | null = null;
      if (requestedYearId) {
        targetYear = await prisma.schoolYear.findUnique({
          where: { id: requestedYearId },
          select: { id: true, name: true },
        });
        if (!targetYear) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
      } else {
        targetYear = await prisma.schoolYear.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
        });
      }
      const schoolYearId = targetYear?.id ?? "__none__";

      const sections = await prisma.section.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, schoolYearId },
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

      const result = sections.map((s) => ({
        id: s.id,
        name: s.name,
        gradeLevel: s.gradeLevel === "G11" ? 11 : 12,
        schoolYear: s.schoolYear?.name ?? targetYear?.name ?? "",
        schoolYearId: s.schoolYearId,
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

// Terms for a school year, straight from the database — the Assign Subjects
// dialog populates its Term picker from here instead of a hardcoded list.
// Missing term rows (1–3) are backfilled so every year always offers Term 1–3.
router.get(
  "/terms",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (req, res, next) => {
    try {
      const requestedYearId =
        typeof req.query.schoolYearId === "string" && req.query.schoolYearId.trim()
          ? req.query.schoolYearId.trim()
          : null;
      let targetYear: { id: string; name: string } | null = null;
      if (requestedYearId) {
        targetYear = await prisma.schoolYear.findUnique({
          where: { id: requestedYearId },
          select: { id: true, name: true },
        });
        if (!targetYear) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
      } else {
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

      // Backfill Terms 1–3 when a year is missing any of them, so every
      // school year always offers the full Term 1–3 set.
      const have = new Set(terms.map((t) => t.termNumber));
      if (!have.has(1) || !have.has(2) || !have.has(3)) {
        await prisma.term.createMany({
          data: [1, 2, 3]
            .filter((n) => !have.has(n))
            .map((termNumber) => ({ schoolYearId: targetYear!.id, termNumber })),
          skipDuplicates: true,
        });
        await invalidateTags(["registrar", "academics"]);
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

// Normalize a school-year label so frontend values like "2026–2027" (en dash,
// no prefix) match stored rows like "SY 2026-2027".
function normalizeYearLabel(raw: string): string {
  return raw.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

function yearCandidates(raw: string): string[] {
  const norm = normalizeYearLabel(raw);
  const withoutPrefix = norm.replace(/^SY\s+/i, "");
  return [norm, `SY ${withoutPrefix}`, withoutPrefix];
}

async function resolveSchoolYear(requested?: string) {
  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  // Try to match the requested label (exact + prefix variants).
  if (requested?.trim()) {
    for (const candidate of yearCandidates(requested)) {
      const found = await prisma.schoolYear.findFirst({ where: { name: candidate } });
      if (found) return found;
    }
  } else if (activeYear) {
    return activeYear;
  }

  // No match: auto-provision instead of 409 so section creation never fails
  // just because the year table is empty or uses a different label format.
  const baseLabel = requested?.trim() ? normalizeYearLabel(requested) : activeYear?.name;
  const name = baseLabel
    ? baseLabel.match(/^\d{4}-\d{4}$/)
      ? `SY ${baseLabel}`
      : baseLabel
    : `SY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  if (activeYear && !requested?.trim()) return activeYear;

  const existing = await prisma.schoolYear.findFirst({ where: { name } });
  if (existing) return existing;

  const yearMatch = name.match(/(\d{4})\D(\d{4})/);
  const startY = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const endY = yearMatch ? Number(yearMatch[2]) : startY + 1;
  const created = await prisma.schoolYear.create({
    data: {
      name,
      startDate: new Date(`${startY}-06-15T00:00:00Z`),
      endDate: new Date(`${endY}-03-31T00:00:00Z`),
      isActive: activeYear ? false : true,
      createdBy: "system",
    },
    select: { id: true, name: true },
  });
  // Every school year needs terms 1-3 or later assignment creation 404s.
  await prisma.term.createMany({
    data: [1, 2, 3].map((termNumber) => ({ schoolYearId: created.id, termNumber })),
    skipDuplicates: true,
  });
  return created;
}

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

      const schoolYearRow = await resolveSchoolYear(schoolYear);

      const duplicate = await prisma.section.findFirst({
        where: {
          name: name.trim(),
          gradeLevel: gl,
          schoolYearId: schoolYearRow.id,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(
          409,
          "DUPLICATE_SECTION",
          `Section "${name.trim()}" already exists for this grade level and school year`
        );
      }

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
        schoolYear: section.schoolYear?.name ?? schoolYearRow.name,
        schoolYearId: section.schoolYearId,
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
        schoolYearId: updated.schoolYearId,
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

      // Teacher subject loads for the active school year, within the registrar
      // grade band (G11/G12). Grouped per teacher + subject, listing the
      // sections each subject is taught in and the term(s).
      const loads = await prisma.teacherSubjectAssignment.findMany({
        where: {
          section: { schoolYear: { isActive: true }, gradeLevel: { in: GRADE_BAND } },
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
        const grade = l.subject.gradeLevel === "G11" ? 11 : 12;
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

// Single teacher with their full workload/assignment rows for the active
// school year within the registrar grade band. One row per section+term.
router.get(
  "/teachers/:id",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "academics"] }),
  async (req, res, next) => {
    try {
      const userId = String(req.params.id);
      const teacher = await prisma.user.findFirst({
        where: { id: userId, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
        select: { id: true, fullName: true },
      });
      if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

      // Advisory section(s) the teacher leads, distinct from subject loads.
      // Only for the active school year within the registrar grade band.
      const advisory = await prisma.section.findMany({
        where: {
          adviserId: userId,
          schoolYear: { isActive: true },
          gradeLevel: { in: GRADE_BAND },
        },
        select: { id: true, name: true, gradeLevel: true },
        orderBy: { name: "asc" },
      });

      const assignments = await prisma.teacherSubjectAssignment.findMany({
        where: {
          teacherId: userId,
          section: { schoolYear: { isActive: true }, gradeLevel: { in: GRADE_BAND } },
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
            gradeLevel: s.gradeLevel === "G11" ? 11 : 12,
          })),
          assignments: assignments.map((a) => ({
            id: a.id,
            subjectId: a.subjectId,
            code: a.subject.code,
            name: a.subject.name,
            gradeLevel: a.subject.gradeLevel === "G11" ? 11 : 12,
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
        select: { id: true, code: true, name: true, gradeLevel: true, category: true },
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
          category: toCategoryLabel(subject.category),
        },
        students: result,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
