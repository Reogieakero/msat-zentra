import { Router } from "express";
import { z } from "zod";
import { GradeLevel } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { AppError } from "../../lib/errors.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { ensureSubjectAssignment, findSubjectTeacherSplits } from "../teacher/teacher.routes.js";
import { getAcademicsSummary } from "./academics.service.js";
import { MAX_ADVISER_BATCH, normalizeAdviserBatch, type AdviserBatchInputRow } from "./adviserBatch.js";
import { mintAdviserCode } from "./adviserCode.js";

const router = Router();

function gradeToNumber(gradeLevel: string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function toGradeEnum(n: number): GradeLevel {
  if (n === 7) return "G7";
  if (n === 8) return "G8";
  if (n === 9) return "G9";
  if (n === 10) return "G10";
  if (n === 11) return "G11";
  if (n === 12) return "G12";
  throw new AppError(400, "INVALID_GRADE_LEVEL", "Grade level must be 7–12");
}

// Active school year for writes: the request's term-scope header when present,
// otherwise the database-active year. Name-based resolution always files rows
// under this year — the client never sends a year.
async function resolveScopeYear(req: {
  termScope?: { schoolYearId?: string | null };
}): Promise<{ id: string; name: string }> {
  const scoped = req.termScope?.schoolYearId ?? null;
  if (scoped) {
    const found = await prisma.schoolYear.findUnique({
      where: { id: scoped },
      select: { id: true, name: true },
    });
    if (!found) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "School year not found");
    return found;
  }
  const active = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!active) throw new AppError(404, "SCHOOL_YEAR_NOT_FOUND", "No school year found");
  return active;
}

function toCategoryLabel(category: string): "Core" | "Elective" {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

// Principal academics KPIs (O4): section summaries, pass/fail by grade, honor roll.
// ?mode=raw includes every graded row (locked or not); ?mode=final (default)
// restricts to locked/finalized grades only.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  // Heavy, unpaginated compute (every student + every subject grade, plus
  // live risk/honor-roll). Grades only change through the Registrar write
  // routes, which invalidate the "academics" tag, so a longer TTL is safe and
  // avoids a cold recompute on every principal navigation.
  cache({ tags: ["academics", "principal"], ttl: 900 }),
  async (req, res, next) => {
    try {
      const mode = req.query.mode === "raw" ? "raw" : "final";
      const scope = req.termScope;
      const summary = await getAcademicsSummary(mode, {
        schoolYearId: scope?.schoolYearId ?? null,
        termId: scope?.termId ?? null,
      });
      res.json(summary);
    } catch (e) {
      next(e);
    }
  }
);

// School years with nested terms (dates included) for the post-login term
// picker. All authenticated roles may read this — it carries no sensitive
// data, only calendar structure. No cache: the picker must reflect newly
// created years/terms immediately after the registrar/record-keeper writes.
router.get("/school-years", requireAuth, async (_req, res, next) => {
  try {
    const now = Date.now();
    const years = await prisma.schoolYear.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        startDate: true,
        endDate: true,
        terms: {
          orderBy: { termNumber: "asc" },
          select: { id: true, termNumber: true, startDate: true, endDate: true },
        },
      },
    });
    res.json({
      schoolYears: years.map((y) => ({
        id: y.id,
        name: y.name,
        isActive: y.isActive,
        isCurrent:
          new Date(y.startDate).getTime() <= now && now <= new Date(y.endDate).getTime(),
        startDate: y.startDate,
        endDate: y.endDate,
        terms: y.terms,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Principal Assigning — school-wide (G7–G12) teacher↔subject↔section mapping.
// Powers /principal/academics/assign. Principal sees every grade; the
// registrar (G11–12) and record-keeper (G7–10) bands keep their own scoped
// routes. All writes are audited.
// ---------------------------------------------------------------------------

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
      // Default to the session's active School Year — pages no longer ask.
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
      // Default to the session's active School Year — pages no longer ask.
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

// ---------------------------------------------------------------------------
// Principal Advisory — assign / clear a section adviser (Section.adviserId).
// Powers /principal/academics/assign, which assigns a teacher as the
// advisory (homeroom) teacher of a section for the active school year.
//
// Single-row PATCH below covers per-row Change/Remove; the batch PATCH
// covers the multi-entry modal in ONE transactional request (no N sequential
// round trips). Writes are atomic (all rows or none); concurrent writers
// resolve last-writer-wins on the single adviser FK — the DB is the source
// of truth and realtime converges other clients.
// ---------------------------------------------------------------------------

function toAdviserResult(updated: {
  id: string;
  name: string;
  gradeLevel: string;
  schoolYearId: string;
  adviserId: string | null;
  adviserLabel: string | null;
  adviserCode?: string | null;
  adviser: { fullName: string } | null;
  schoolYear: { name: string } | null;
}) {
  return {
    id: updated.id,
    name: updated.name,
    gradeLevel: gradeToNumber(updated.gradeLevel),
    schoolYear: updated.schoolYear?.name ?? "",
    schoolYearId: updated.schoolYearId,
    adviserId: updated.adviserId ?? "",
    // Display name: linked teacher first, free-text label otherwise — the
    // listing never depends on a teacher account existing.
    adviserName: updated.adviser?.fullName ?? updated.adviserLabel ?? "",
    adviserLabel: updated.adviserLabel ?? "",
    // Claim code — principal-only surface. Empty until claimed flow mints one,
    // consumed (cleared) once the teacher claims with it.
    adviserCode: updated.adviserCode ?? "",
  };
}

// Mint a collision-free advisory code (ADV-XXXXX). Retries on the rare
// unique-clash, same pattern as TeacherName MS-101 codes.
async function mintUniqueAdviserCode(exclude?: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = mintAdviserCode();
    if (exclude?.has(candidate)) continue;
    const clash = await prisma.section.findUnique({
      where: { adviserCode: candidate },
      select: { id: true },
    });
    if (!clash) {
      exclude?.add(candidate);
      return candidate;
    }
  }
  throw new AppError(500, "CODE_MINT_FAILED", "Could not mint a unique advisory code, try again");
}

function assertInScope(req: { termScope?: { schoolYearId?: string | null } }, schoolYearId: string) {
  const scopeYearId = req.termScope?.schoolYearId ?? null;
  if (scopeYearId && schoolYearId !== scopeYearId) {
    throw new AppError(
      403,
      "SCOPE_MISMATCH",
      "Section is outside the active school year"
    );
  }
}

// ---------------------------------------------------------------------------
// Principal Sections — the principal (not the registrar) owns section
// creation. New sections are filed under the active school year automatically.
// ---------------------------------------------------------------------------

router.post(
  "/assign/sections",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { name, gradeLevel } = req.body as { name?: string; gradeLevel?: number };
      if (!name?.trim()) throw new AppError(400, "MISSING_NAME", "Section name is required");
      const gl = toGradeEnum(Number(gradeLevel));
      const scopeYear = await resolveScopeYear(req);

      const duplicate = await prisma.section.findFirst({
        where: { name: name.trim(), gradeLevel: gl, schoolYearId: scopeYear.id },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(
          409,
          "DUPLICATE_SECTION",
          `Section "${name.trim()}" already exists for Grade ${gradeToNumber(gl)} in ${scopeYear.name}`
        );
      }

      const section = await prisma.section.create({
        data: { name: name.trim(), gradeLevel: gl, schoolYearId: scopeYear.id, adviserId: null },
        include: { schoolYear: { select: { id: true, name: true } } },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "create",
        sourceTable: "sections",
        sourceId: section.id,
        reason: "Principal created section",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.status(201).json({
        id: section.id,
        name: section.name,
        gradeLevel: gradeToNumber(section.gradeLevel),
        schoolYear: section.schoolYear?.name ?? scopeYear.name,
        schoolYearId: section.schoolYearId,
        adviserId: "",
        adviserName: "",
        assignments: [],
      });
    } catch (e) {
      next(e);
    }
  }
);

// Principal section deletion — hard delete, guarded: a section anchoring
// students, roster entries, assignments, or any records cannot be deleted.
// Clear/reassign those first; the 409 names the blocker instead of failing
// on a raw foreign-key error.
router.delete(
  "/assign/sections/:id",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const section = await prisma.section.findUnique({
        where: { id },
        select: { id: true, name: true, schoolYearId: true },
      });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);

      const [students, roster, assignments, attendance, anecdotal, flags, sf10] =
        await Promise.all([
          prisma.studentProfile.count({ where: { sectionId: id } }),
          prisma.studentRoster.count({ where: { sectionId: id } }),
          prisma.teacherSubjectAssignment.count({ where: { sectionId: id } }),
          prisma.attendanceRecord.count({ where: { sectionId: id } }),
          prisma.anecdotalRecord.count({ where: { sectionId: id } }),
          prisma.gradeFlag.count({ where: { sectionId: id } }),
          prisma.adviserSf10AccessRequest.count({ where: { sectionId: id } }),
        ]);
      const linked = students + roster + assignments + attendance + anecdotal + flags + sf10;
      if (linked > 0) {
        const parts: string[] = [];
        if (students + roster > 0) parts.push("students");
        if (assignments > 0) parts.push("teacher assignments");
        if (attendance + anecdotal + flags > 0) parts.push("records");
        if (sf10 > 0) parts.push("SF10 access requests");
        throw new AppError(
          409,
          "SECTION_HAS_RECORDS",
          `Cannot delete "${section.name}" — it still has ${parts.join(", ")}. Clear or reassign them first.`
        );
      }

      await prisma.section.delete({ where: { id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "delete",
        sourceTable: "sections",
        sourceId: id,
        reason: "Principal deleted section",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json({ id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

// Batch section resolution: by id when given, otherwise by (name + grade)
// inside the scope year — the database is the source of truth, not the
// client's cached list. Id- and name-based lookups run concurrently.
async function resolveBatchSections(
  rows: AdviserBatchInputRow[],
  scopeYearId: string,
): Promise<string[]> {
  const sectionIds = new Array<string>(rows.length);
  const nameHitByRow = new Map<AdviserBatchInputRow, string>();
  const idRows = rows.filter((r) => r.sectionId);
  const nameRows = rows.filter((r) => !r.sectionId);

  const byIdPromise = (async () => {
    const byId = new Map<string, string>();
    if (idRows.length === 0) return byId;
    const ids = [...new Set(idRows.map((r) => r.sectionId as string))];
    const found = await prisma.section.findMany({
      where: { id: { in: ids } },
      select: { id: true, schoolYearId: true },
    });
    if (found.length !== ids.length) {
      throw new AppError(404, "SECTION_NOT_FOUND", "One or more sections were not found");
    }
    for (const s of found) {
      if (s.schoolYearId !== scopeYearId) {
        throw new AppError(403, "SCOPE_MISMATCH", "One or more sections are outside the active school year");
      }
      byId.set(s.id, s.id);
    }
    return byId;
  })();

  const byNamePromise = (async () => {
    if (nameRows.length === 0) return;
    const grades = [...new Set(nameRows.map((r) => toGradeEnum(r.gradeLevel!)))];
    const candidates = await prisma.section.findMany({
      where: { schoolYearId: scopeYearId, gradeLevel: { in: grades } },
      select: { id: true, name: true, gradeLevel: true },
    });
    for (const r of nameRows) {
      const typed = r.sectionName!.trim();
      const wantGrade = toGradeEnum(r.gradeLevel!);
      const pool = candidates.filter((s) => s.gradeLevel === wantGrade);
      // Prefer the exact-case row when near-duplicates exist.
      const hit =
        pool.find((s) => s.name === typed) ??
        pool.find((s) => s.name.trim().toLowerCase() === typed.toLowerCase());
      if (!hit) {
        throw new AppError(
          404,
          "SECTION_NOT_FOUND",
          `No section named "${typed}" in Grade ${r.gradeLevel}.`
        );
      }
      nameHitByRow.set(r, hit.id);
    }
  })();

  const [byId] = await Promise.all([byIdPromise, byNamePromise]);
  rows.forEach((r, i) => {
    sectionIds[i] = r.sectionId ? byId.get(r.sectionId)! : nameHitByRow.get(r)!;
  });
  return sectionIds;
}

// Batch teacher resolution: by id when given, otherwise by typed name.
// Listing never blocks on accounts: an exact (else single insensitive) match
// links the teacher, otherwise the name is stored as a free-text label.
async function resolveBatchTeachers(rows: AdviserBatchInputRow[]): Promise<{
  teacherForRow: (string | null)[];
  labelForRow: (string | null)[];
}> {
  const teacherForRow = new Array<string | null>(rows.length).fill(null);
  const labelForRow = new Array<string | null>(rows.length).fill(null);
  const idIdx = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.adviserId);
  const nameIdx = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.adviserId && r.adviserName);
  const byIdPromise = (async () => {
    const byId = new Map<string, string>();
    if (idIdx.length === 0) return byId;
    const ids = [...new Set(idIdx.map(({ r }) => r.adviserId as string))];
    const found = await prisma.user.findMany({
      where: { id: { in: ids }, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
      select: { id: true, fullName: true },
    });
    if (found.length !== ids.length) {
      throw new AppError(404, "TEACHER_NOT_FOUND", "One or more teachers were not found or are not active");
    }
    for (const t of found) byId.set(t.id, t.fullName);
    return byId;
  })();
  const byNamePromise = (async () => {
    const byName = new Map<string, { id: string; fullName: string }[]>();
    if (nameIdx.length === 0) return byName;
    const nameKeys = [...new Set(nameIdx.map(({ r }) => r.adviserName!.trim().toLowerCase()))];
    const found = await prisma.user.findMany({
      where: {
        fullName: { in: nameKeys, mode: "insensitive" },
        role: { in: ["subject_teacher", "adviser"] },
        status: "active",
      },
      select: { id: true, fullName: true },
    });
    for (const t of found) {
      const k = t.fullName.trim().toLowerCase();
      const list = byName.get(k) ?? [];
      list.push(t);
      byName.set(k, list);
    }
    return byName;
  })();
  const [byId, byName] = await Promise.all([byIdPromise, byNamePromise]);
  for (const { r, i } of idIdx) {
    teacherForRow[i] = r.adviserId as string;
    labelForRow[i] = byId.get(r.adviserId as string) ?? null;
  }
  for (const { r, i } of nameIdx) {
    const typed = r.adviserName!.trim();
    const candidates = byName.get(typed.toLowerCase()) ?? [];
    const hit =
      candidates.find((c) => c.fullName === typed) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    teacherForRow[i] = hit?.id ?? null;
    labelForRow[i] = typed;
  }
  return { teacherForRow, labelForRow };
}

router.patch(
  "/assign/sections/advisers",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { assignments } = req.body as {
        assignments?: {
          sectionId?: string;
          sectionName?: string;
          gradeLevel?: number;
          adviserId?: string | null;
          adviserName?: string;
        }[];
      };
      // Pure validation/normalization (unit-tested) — fails fast before any query.
      const rows = normalizeAdviserBatch(assignments);
      // Scope, sections, and teachers resolve concurrently — none of these
      // reads depends on another, so sequential awaits only add round trips.
      const scopeYearPromise = resolveScopeYear(req);
      const teacherPromise = resolveBatchTeachers(rows);
      const sectionPromise = scopeYearPromise.then((sy) => resolveBatchSections(rows, sy.id));
      const [sectionIds, { labelForRow }] = await Promise.all([
        sectionPromise,
        teacherPromise,
      ]);

      // Code-claim model: assigning stores label + freshly minted code with
      // adviserId NULL — the teacher becomes adviser only after entering the
      // code. Clearing wipes label + code. Codes are minted pre-transaction
      // (unique per row) so the atomic write stays a single transaction.
      const minted = new Set<string>();
      const codeForRow: (string | null)[] = [];
      for (const label of labelForRow) {
        if (label) codeForRow.push(await mintUniqueAdviserCode(minted));
        else codeForRow.push(null);
      }

      // Atomic transaction: every row writes or none does.
      const updated = await prisma.$transaction(
        sectionIds.map((sectionId, i) =>
          prisma.section.update({
            where: { id: sectionId },
            data: {
              adviserId: null,
              adviserLabel: labelForRow[i],
              adviserCode: codeForRow[i],
            },
            include: {
              adviser: { select: { id: true, fullName: true } },
              schoolYear: { select: { id: true, name: true } },
            },
          })
        )
      );

      // Audit is best-effort (writeAudit swallows its own errors) — run all
      // rows concurrently so a 20-row batch doesn't pay 20 sequential
      // inserts on the critical path after the transaction commits.
      await Promise.allSettled(
        updated.map((u) =>
          writeAudit({
            userId: req.user!.id,
            actionType: "update",
            sourceTable: "sections",
            sourceId: u.id,
            reason: (u as { adviserLabel?: string | null }).adviserLabel
              ? "Principal assigned section adviser + code (batch)"
              : "Principal cleared section adviser (batch)",
          })
        )
      );
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json({ updated: updated.map(toAdviserResult) });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/assign/sections/:id/adviser",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { adviserId, adviserName } = req.body as {
        adviserId?: string | null;
        adviserName?: string | null;
      };

      const trimmedId =
        adviserId == null || String(adviserId).trim() === "" ? null : String(adviserId).trim();
      const trimmedName =
        adviserName == null || String(adviserName).trim() === "" ? null : String(adviserName).trim();

      // Section + teacher reads are independent — run them together instead
      // of paying two sequential round trips on every assign/remove.
      const [section, teacher] = await Promise.all([
        prisma.section.findUnique({ where: { id } }),
        trimmedId
          ? prisma.user.findFirst({
              where: {
                id: trimmedId,
                role: { in: ["subject_teacher", "adviser"] },
                status: "active",
              },
              select: { id: true, fullName: true },
            })
          : Promise.resolve(null),
      ]);
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);

      // Code-claim model: the principal files label + code only; adviserId
      // stays NULL until the teacher claims with the code.
      let nextLabel: string | null = null;
      if (trimmedId) {
        if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found or not active");
        nextLabel = teacher.fullName;
      } else if (trimmedName) {
        nextLabel = trimmedName;
      }
      const nextCode = nextLabel ? await mintUniqueAdviserCode() : null;

      const updated = await prisma.section.update({
        where: { id },
        data: { adviserId: null, adviserLabel: nextLabel, adviserCode: nextCode },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { id: true, name: true } },
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "sections",
        sourceId: updated.id,
        reason: nextLabel
          ? "Principal assigned section adviser + code"
          : "Principal cleared section adviser",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json(toAdviserResult(updated));
    } catch (e) {
      next(e);
    }
  }
);

// Principal advisory code regeneration — mints a replacement code for a
// section that already has a listed adviser (label present, not yet claimed).
// Used when the code is lost. Claimed sections (adviserId set) and empty
// sections reject — re-assign instead.
router.post(
  "/assign/sections/:id/adviser-code/regenerate",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const section = await prisma.section.findUnique({ where: { id } });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);
      const row = section as typeof section & {
        adviserLabel?: string | null;
        adviserId?: string | null;
      };
      if (row.adviserId) {
        throw new AppError(
          409,
          "ALREADY_CLAIMED",
          "This section is already claimed — codes are single-use and rotate on the next assignment.",
        );
      }
      if (!row.adviserLabel) {
        throw new AppError(
          400,
          "NO_ADVISER_LISTED",
          "List an adviser first — regeneration needs a pending assignment.",
        );
      }
      const nextCode = await mintUniqueAdviserCode();
      const updated = await prisma.section.update({
        where: { id },
        data: { adviserCode: nextCode },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { id: true, name: true } },
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "sections",
        sourceId: updated.id,
        reason: "Principal regenerated advisory code",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);
      res.json(toAdviserResult(updated));
    } catch (e) {
      next(e);
    }
  }
);

// ---------------------------------------------------------------------------
// Schedule approval: timetables the master teacher sent for review. Approve
// makes the slots official (materializes gradebook assignments owned by the
// submitting master); reject sends them back to draft with a revision note.
// ---------------------------------------------------------------------------

// Sections with submitted slots in the active term, with the submission for
// review. Approved history is not listed — only the pending queue.
// Every grades 7–10 section with its active-term timetable entries, whatever
// the status — the principal grid always shows all section cards, and the
// per-section review page reads from the same payload.
router.get(
  "/schedule/sections",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const sections = await prisma.section.findMany({
        where: {
          gradeLevel: { in: ["G7", "G8", "G9", "G10"] },
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          adviser: { select: { fullName: true } },
          timetableEntries: {
            where: { termId },
            select: {
              day: true,
              period: true,
              status: true,
              subject: { select: { id: true, name: true, code: true } },
              teacherName: { select: { id: true, name: true } },
              submittedAt: true,
              submitter: { select: { fullName: true } },
            },
            orderBy: [{ day: "asc" }, { period: "asc" }],
          },
        },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      res.json({ sections });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/schedule/submissions",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["academics", "principal"] }),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const sections = await prisma.section.findMany({
        where: {
          gradeLevel: { in: ["G7", "G8", "G9", "G10"] },
          timetableEntries: { some: { termId, status: "SUBMITTED" } },
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          adviser: { select: { fullName: true } },
          timetableEntries: {
            where: { termId, status: "SUBMITTED" },
            select: {
              day: true,
              period: true,
              subject: { select: { id: true, name: true, code: true } },
              teacherName: { select: { id: true, name: true } },
              submittedAt: true,
              submitter: { select: { fullName: true } },
            },
            orderBy: [{ day: "asc" }, { period: "asc" }],
          },
        },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
      res.json({ sections });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/schedule/review",
  requireAuth,
  requireRole("principal"),
  validate(
    "body",
    z.object({
      sectionId: z.string(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().max(500).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const principalId = req.user!.id;
      const { sectionId, decision, note } = req.body as {
        sectionId: string;
        decision: "approve" | "reject";
        note?: string;
      };
      if (decision === "reject" && !note?.trim()) {
        throw new AppError(400, "NOTE_REQUIRED", "A revision note is required to reject");
      }
      const termId = await resolveActiveTermId(req);
      if (!termId) {
        throw new AppError(400, "NO_ACTIVE_TERM", "No active term selected");
      }
      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section || !["G7", "G8", "G9", "G10"].includes(section.gradeLevel as string)) {
        throw new AppError(403, "GRADE_BAND_NOT_ALLOWED", "Schedule review covers grades 7–10");
      }
      const submitted = await prisma.sectionTimetableEntry.findMany({
        where: { sectionId, termId, status: "SUBMITTED" },
        select: { id: true, subjectId: true, submittedBy: true },
      });
      if (submitted.length === 0) {
        throw new AppError(404, "NO_SUBMISSION", "No submitted slots for this section");
      }
      // Legacy splits saved before the one-teacher-per-subject rule must be
      // unified before approval — approving them would make the split
      // official. Covers submitted + already-approved rows in this section.
      const splits = await findSubjectTeacherSplits({ sectionId, termId });
      if (decision === "approve" && splits.length > 0) {
        const detail = splits
          .map((s) => `${s.subjectName} (${s.teacherNames.join(", ")})`)
          .join("; ");
        throw new AppError(
          409,
          "SUBJECT_TEACHER_SPLIT",
          `One subject takes one teacher per section — return this timetable for revision: ${detail}. Each subject must be unified to a single teacher.`,
        );
      }
      const now = new Date();
      const trimmedNote = note?.trim() ? note.trim() : null;
      if (decision === "approve") {
        await prisma.sectionTimetableEntry.updateMany({
          where: { sectionId, termId, status: "SUBMITTED" },
          data: {
            status: "APPROVED",
            reviewedBy: principalId,
            reviewedAt: now,
            reviewNote: trimmedNote,
          },
        });
        // Gradebook ownership goes to the master who submitted each subject —
        // never the reviewing principal.
        const owners = new Map<string, string>();
        for (const e of submitted) {
          if (!e.submittedBy) {
            throw new AppError(
              500,
              "OWNER_UNRESOLVED",
              "A submitted slot has no submitting teacher"
            );
          }
          if (!owners.has(e.subjectId)) owners.set(e.subjectId, e.submittedBy);
        }
        // Ownership checks + audit run concurrently instead of one DB
        // round-trip at a time. The cache purge stays last and awaited so
        // the next read (after res.json) is guaranteed live.
        await Promise.all([
          ...[...owners].map(([subjectId, ownerId]) =>
            ensureSubjectAssignment(ownerId, subjectId, sectionId, termId),
          ),
          writeAudit({
            userId: principalId,
            actionType: "update",
            sourceTable: "section_timetable_entries",
            sourceId: sectionId,
            reason: `Principal approved ${submitted.length} timetable slots for ${section.name}`,
          }),
        ]);
        await invalidateTags(["academics", "principal", "teacher", "schedule"]);
        res.json({ approved: submitted.length });
        // Each submitting master learns the verdict from their bell.
        for (const ownerId of new Set(submitted.map((e) => e.submittedBy as string))) {
          void fanoutNotification({
            userId: ownerId,
            sourceTable: "section_timetable_entries",
            action: "approve",
            sourceId: sectionId,
            message: `Principal approved ${submitted.length} timetable slots for ${section.name} — official.`,
          });
        }
      } else {
        await prisma.sectionTimetableEntry.updateMany({
          where: { sectionId, termId, status: "SUBMITTED" },
          data: {
            status: "DRAFT",
            submittedBy: null,
            submittedAt: null,
            reviewedBy: principalId,
            reviewedAt: now,
            reviewNote: trimmedNote,
          },
        });
        await Promise.all([
          writeAudit({
            userId: principalId,
            actionType: "update",
            sourceTable: "section_timetable_entries",
            sourceId: sectionId,
            reason: `Principal requested revisions on ${section.name}: ${trimmedNote}`,
          }),
          invalidateTags(["academics", "principal", "teacher", "schedule"]),
        ]);
        res.json({ rejected: submitted.length });
        for (const ownerId of new Set(submitted.map((e) => e.submittedBy as string))) {
          void fanoutNotification({
            userId: ownerId,
            sourceTable: "section_timetable_entries",
            action: "reject",
            sourceId: sectionId,
            message: `Principal requested revisions on ${section.name}: ${trimmedNote}`,
          });
        }
      }
    } catch (e) {
      next(e);
    }
  }
);

export default router;
