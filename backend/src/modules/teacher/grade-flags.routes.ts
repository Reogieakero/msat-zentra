import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { runEscalation } from "../../services/gradeFlags.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

const REASONS = [
  "wrong_score",
  "missing_assessment",
  "transmutation_error",
  "late_submission",
  "other",
] as const;

const raiseSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  reason: z.enum(REASONS),
  note: z.string().max(2000).optional(),
});

const resolveSchema = z.object({
  resolutionNote: z.string().min(1).max(2000),
});

const listQuerySchema = z.object({
  scope: z.enum(["mine", "against-me", "advisees"]).default("mine"),
  status: z.enum(["open", "resolved", "escalated"]).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

interface FlagRow {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  ownerId: string | null;
  createdAt: Date;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  student: { userId: string; lrn: string; user: { fullName: string } };
  subject: { id: string; name: string };
  section: { id: string; name: string };
  term: { id: string; termNumber: number };
  raisedByUser: { id: string; fullName: string };
  owner: { id: string; fullName: string } | null;
  resolvedByUser: { id: string; fullName: string } | null;
}

function serializeFlag(f: FlagRow) {
  const ageDays = Math.floor((Date.now() - f.createdAt.getTime()) / 86_400_000);
  return {
    id: f.id,
    reason: f.reason,
    note: f.note,
    status: f.status,
    ageDays,
    createdAt: f.createdAt,
    escalatedAt: f.escalatedAt,
    resolvedAt: f.resolvedAt,
    resolutionNote: f.resolutionNote,
    student: { id: f.student.userId, name: f.student.user.fullName, lrn: f.student.lrn },
    subject: { id: f.subject.id, name: f.subject.name },
    section: { id: f.section.id, name: f.section.name },
    term: { id: f.term.id, termNumber: f.term.termNumber },
    raisedBy: f.raisedByUser,
    owner: f.owner,
  };
}

// Sections this teacher owns (assignments) + advises (adviser link).
async function teacherScope(teacherId: string) {
  const [assignments, advised] = await Promise.all([
    prisma.teacherSubjectAssignment.findMany({
      where: { teacherId },
      select: { subjectId: true, sectionId: true, termId: true },
    }),
    prisma.section.findMany({
      where: { adviserId: teacherId },
      select: { id: true },
    }),
  ]);
  const assignedSectionIds = Array.from(new Set(assignments.map((a) => a.sectionId)));
  const advisedSectionIds = advised.map((s) => s.id);
  return { assignments, assignedSectionIds, advisedSectionIds };
}

// GET /api/teacher/grade-flags?scope=mine|against-me|advisees&status=&q=
// Runs lazy escalation first so `escalated` rows are always current.
router.get(
  "/",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("query", listQuerySchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { scope, status, q, page, pageSize, limit } = req.query as unknown as z.infer<typeof listQuerySchema>;
      // Flag queues are scoped to the session's active term.
      const scopeTermId = req.termScope?.termId ?? null;
      const termFilter = scopeTermId ? { termId: scopeTermId } : {};
      // Server-paginated (?page=&pageSize=, legacy ?limit=). Callers with
      // no pagination params keep the bare-array shape.
      const rawSize = pageSize ?? limit;
      const effPageSize = rawSize && rawSize > 0 ? Math.min(Math.floor(rawSize), 100) : 15;
      const effPage = Math.max(1, page ?? 1);
      const hasPaginationParams = page !== undefined || pageSize !== undefined || limit !== undefined;
      // Case-insensitive queue search across the joined student name,
      // LRN, and subject — evaluated in the database so paging reads only
      // the visible slice (was: fetch-all then slice in memory).
      const needle = q?.trim() ? q.trim() : null;
      const queryFilter = needle
        ? {
            OR: [
              { student: { user: { fullName: { contains: needle, mode: "insensitive" as const } } } },
              { student: { lrn: { contains: needle, mode: "insensitive" as const } } },
              { subject: { name: { contains: needle, mode: "insensitive" as const } } },
            ],
          }
        : {};
      // Real DB pagination: skip/take + count in one round-trip. Shape is
      // unchanged (bare array without params, pager object with params).
      const pagedFlags = async (
        where: Record<string, unknown>,
      ): Promise<unknown> => {
        if (!hasPaginationParams) {
          const rows = await prisma.gradeFlag.findMany({
            where,
            include: flagInclude(),
            orderBy: { createdAt: "desc" },
          });
          return rows.map(serializeFlag);
        }
        const [total, rows] = await Promise.all([
          prisma.gradeFlag.count({ where }),
          prisma.gradeFlag.findMany({
            where,
            include: flagInclude(),
            orderBy: { createdAt: "desc" },
            skip: (effPage - 1) * effPageSize,
            take: effPageSize,
          }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / effPageSize));
        const safePage = Math.min(effPage, totalPages);
        const data = rows.map(serializeFlag);
        return {
          data,
          rows: data,
          total,
          unfilteredTotal: total,
          summary: { total, filtered: total },
          page: safePage,
          totalPages,
          limit: effPageSize,
          pageSize: effPageSize,
        };
      };

      await runEscalation();

      if (scope === "advisees") {
        const advised = await prisma.section.findMany({
          where: { adviserId: teacherId },
          select: { id: true },
        });
        if (advised.length === 0) {
          throw new AppError(403, "FORBIDDEN", "Adviser scope requires an advisory section");
        }
        const adviseeIds = (
          await prisma.studentProfile.findMany({
            where: { sectionId: { in: advised.map((s) => s.id) } },
            select: { userId: true },
          })
        ).map((s) => s.userId);
        return res.json(
          await pagedFlags({
            studentId: { in: adviseeIds },
            ...(status ? { status } : {}),
            ...termFilter,
            ...queryFilter,
          }),
        );
      }

      const where =
        scope === "mine"
          ? { raisedBy: teacherId }
          : { ownerId: teacherId };
      res.json(
        await pagedFlags({
          ...where,
          ...(status ? { status } : {}),
          ...termFilter,
          ...queryFilter,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

function flagInclude() {
  return {
    student: { select: { userId: true, lrn: true, user: { select: { fullName: true } } } },
    subject: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
    term: { select: { id: true, termNumber: true } },
    raisedByUser: { select: { id: true, fullName: true } },
    owner: { select: { id: true, fullName: true } },
    resolvedByUser: { select: { id: true, fullName: true } },
  } as const;
}

// GET /api/teacher/grade-flags/options — scoped pickers for the raise dialog.
// Class options are limited to the session's active term so filings always
// land in the selected scope — the dialog never picks a term itself.
router.get(
  "/options",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const { assignedSectionIds, advisedSectionIds } = await teacherScope(teacherId);
      const sectionIds = Array.from(new Set([...assignedSectionIds, ...advisedSectionIds]));
      // Session's active term — class/section options follow it.
      const scopeTermId = req.termScope?.termId ?? null;
      const termFilter = scopeTermId ? { termId: scopeTermId } : {};

      const [profiles, rosterEntries, assignments, sectionClasses] = await Promise.all([
        prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          select: {
            userId: true,
            lrn: true,
            sectionId: true,
            user: { select: { fullName: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
        // Enlisted students without accounts (no login yet) — keyed
        // `roster:<id>`. Grade-flag raising stays profile-only; the
        // anecdotal composer accepts both.
        prisma.studentRoster.findMany({
          where: { sectionId: { in: sectionIds } },
          select: { id: true, lrn: true, fullName: true, sectionId: true },
          orderBy: { fullName: "asc" },
        }),
        prisma.teacherSubjectAssignment.findMany({
          where: { teacherId, ...termFilter },
          include: {
            subject: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            term: { select: { id: true, termNumber: true } },
          },
        }),
        // Every gradebook in the teacher's sections (whoever owns it) — so a
        // flag can target any of the student's subjects, not just the
        // teacher's own assignments.
        prisma.teacherSubjectAssignment.findMany({
          where: { sectionId: { in: sectionIds }, ...termFilter },
          include: {
            subject: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
            term: { select: { id: true, termNumber: true } },
            teacher: { select: { id: true, fullName: true } },
          },
          orderBy: [{ sectionId: "asc" }, { subject: { name: "asc" } }],
        }),
      ]);

      const registeredLrns = new Set(profiles.map((s) => s.lrn));
      res.json({
        students: [
          ...profiles.map((s) => ({
            id: s.userId,
            name: s.user.fullName,
            lrn: s.lrn,
            sectionId: s.sectionId,
            hasAccount: true as const,
          })),
          ...rosterEntries
            .filter((r) => !registeredLrns.has(r.lrn))
            .map((r) => ({
              id: `roster:${r.id}`,
              name: r.fullName,
              lrn: r.lrn,
              sectionId: r.sectionId,
              hasAccount: false as const,
            })),
        ],
        classes: assignments.map((a) => ({
          subjectId: a.subject.id,
          subjectName: a.subject.name,
          sectionId: a.section.id,
          sectionName: a.section.name,
          termId: a.term.id,
          termNumber: a.term.termNumber,
        })),
        sectionClasses: sectionClasses.map((a) => ({
          subjectId: a.subject.id,
          subjectName: a.subject.name,
          sectionId: a.section.id,
          sectionName: a.section.name,
          termId: a.term.id,
          termNumber: a.term.termNumber,
          ownerName: a.teacher.fullName,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/grade-flags — any teacher may flag any student's grade.
// The gradebook owner is resolved server-side from TeacherSubjectAssignment.
router.post(
  "/",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", raiseSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const body = req.body as z.infer<typeof raiseSchema>;
      // Flags are always filed under the session's active term — the client
      // never picks a term per action.
      const termId = req.termScope?.termId ?? body.termId;

      const [student, subject, section, term] = await Promise.all([
        prisma.studentProfile.findUnique({ where: { userId: body.studentId } }),
        prisma.subject.findUnique({ where: { id: body.subjectId } }),
        prisma.section.findUnique({ where: { id: body.sectionId } }),
        prisma.term.findUnique({ where: { id: termId } }),
      ]);
      if (!student || !subject || !section || !term) {
        throw new AppError(404, "FLAG_TARGET_NOT_FOUND", "Student, subject, section, or term not found");
      }

      const ownerAssignment = await prisma.teacherSubjectAssignment.findFirst({
        where: { subjectId: body.subjectId, sectionId: body.sectionId, termId },
        select: { teacherId: true },
      });

      const flag = await prisma.gradeFlag.create({
        data: {
          studentId: body.studentId,
          subjectId: body.subjectId,
          sectionId: body.sectionId,
          termId,
          reason: body.reason,
          note: body.note,
          raisedBy: teacherId,
          ownerId: ownerAssignment?.teacherId ?? null,
        },
        include: flagInclude(),
      });

      await writeAudit({
        userId: teacherId,
        actionType: "grade_flag_raise",
        sourceTable: "grade_flags",
        sourceId: flag.id,
        reason: `${body.reason} — ${subject.name} / ${section.name}`,
      });
      await invalidateTags(["teacher", "overview", "academics", "principal", "risk", "guidance"]);

      res.status(201).json(serializeFlag(flag));
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/teacher/grade-flags/:id/resolve — gradebook owner only, with note.
// Editing the grade never auto-resolves; resolution is always explicit.
router.post(
  "/:id/resolve",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  validate("body", resolveSchema),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const body = req.body as z.infer<typeof resolveSchema>;
      const flag = await prisma.gradeFlag.findUnique({
        where: { id: String(req.params.id) },
        include: flagInclude(),
      });
      if (!flag) throw new AppError(404, "FLAG_NOT_FOUND", "Grade flag not found");
      if (flag.status === "resolved") {
        throw new AppError(409, "FLAG_ALREADY_RESOLVED", "Flag is already resolved");
      }
      if (flag.ownerId !== teacherId) {
        throw new AppError(403, "FORBIDDEN", "Only the gradebook owner can resolve this flag");
      }

      const updated = await prisma.gradeFlag.update({
        where: { id: flag.id },
        data: {
          status: "resolved",
          resolvedBy: teacherId,
          resolvedAt: new Date(),
          resolutionNote: body.resolutionNote,
        },
        include: flagInclude(),
      });

      await writeAudit({
        userId: teacherId,
        actionType: "grade_flag_resolve",
        sourceTable: "grade_flags",
        sourceId: flag.id,
        reason: body.resolutionNote,
      });
      await invalidateTags(["teacher", "overview", "academics", "principal", "risk", "guidance"]);

      res.json(serializeFlag(updated));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
