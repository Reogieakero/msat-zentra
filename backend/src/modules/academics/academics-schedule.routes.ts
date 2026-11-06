import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { AppError } from "../../lib/errors.js";
import { resolveActiveTermId } from "../../services/risk.js";
import { ensureSubjectAssignment, findSubjectTeacherSplits } from "../teacher/teacher.repository.js";

const router = Router();

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
          gradeLevel: { in: ["G7", "G8", "G9", "G10", "G11", "G12"] },
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
              reviewNote: true,
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
          gradeLevel: { in: ["G7", "G8", "G9", "G10", "G11", "G12"] },
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
      if (
        !section ||
        !["G7", "G8", "G9", "G10", "G11", "G12"].includes(section.gradeLevel as string)
      ) {
        throw new AppError(403, "GRADE_BAND_NOT_ALLOWED", "Schedule review covers grades 7–12");
      }
      const submitted = await prisma.sectionTimetableEntry.findMany({
        where: { sectionId, termId, status: "SUBMITTED" },
        select: { id: true, subjectId: true, submittedBy: true },
      });
      if (submitted.length === 0) {
        throw new AppError(404, "NO_SUBMISSION", "No submitted slots for this section");
      }
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
            // Approval must not leave a revision note behind: reviewNote
            // drives the teacher-side "Returned" card, which is strictly
            // DRAFT + note. Persisting the approve-dialog text here is what
            // made approved sections read as returned for teachers.
            reviewNote: null,
          },
        });
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
        for (const ownerId of new Set(submitted.map((e) => e.submittedBy as string))) {
          void fanoutNotification({
            userId: ownerId,
            sourceTable: "section_timetable_entries",
            action: "approve",
            sourceId: sectionId,
            message: `Principal approved ${submitted.length} timetable slots for ${section.name} — official.`,
          });
        }
        void (async () => {
          try {
            const [assignments, timetableTeachers, sec] = await Promise.all([
              prisma.teacherSubjectAssignment.findMany({ where: { sectionId, termId }, select: { teacherId: true } }),
              prisma.sectionTimetableEntry.findMany({ where: { sectionId, termId }, select: { teacherName: { select: { userId: true } } } }),
              prisma.section.findUnique({ where: { id: sectionId }, select: { adviserId: true } }),
            ]);
            const ids = new Set<string>();
            for (const a of assignments) ids.add(a.teacherId);
            for (const t of timetableTeachers) { const uid = (t.teacherName as { userId?: string | null } | null)?.userId; if (uid) ids.add(uid); }
            if (sec?.adviserId) ids.add(sec.adviserId);
            for (const e of submitted) { if (e.submittedBy) ids.delete(e.submittedBy as string); }
            for (const uid of ids) {
              await fanoutNotification({
                userId: uid,
                sourceTable: "section_timetable_entries",
                action: "approve",
                sourceId: sectionId,
                message: `Principal approved the timetable for ${section.name} — ${submitted.length} slots official.`,
              });
            }
          } catch { /* best-effort */ }
        })();
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
        void (async () => {
          try {
            const [assignments, timetableTeachers, sec] = await Promise.all([
              prisma.teacherSubjectAssignment.findMany({ where: { sectionId, termId }, select: { teacherId: true } }),
              prisma.sectionTimetableEntry.findMany({ where: { sectionId, termId }, select: { teacherName: { select: { userId: true } } } }),
              prisma.section.findUnique({ where: { id: sectionId }, select: { adviserId: true } }),
            ]);
            const ids = new Set<string>();
            for (const a of assignments) ids.add(a.teacherId);
            for (const t of timetableTeachers) { const uid = (t.teacherName as { userId?: string | null } | null)?.userId; if (uid) ids.add(uid); }
            if (sec?.adviserId) ids.add(sec.adviserId);
            for (const e of submitted) { if (e.submittedBy) ids.delete(e.submittedBy as string); }
            for (const uid of ids) {
              await fanoutNotification({
                userId: uid,
                sourceTable: "section_timetable_entries",
                action: "reject",
                sourceId: sectionId,
                message: `Principal requested revisions on ${section.name}: ${trimmedNote}`,
              });
            }
          } catch { /* best-effort */ }
        })();
      }
    } catch (e) {
      next(e);
    }
  }
);

export default router;
