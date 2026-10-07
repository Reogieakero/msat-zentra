import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole, requireOwnershipOrRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { recomputeSubjectFinal } from "../../services/grading.js";
import { recomputeRisk, recomputeRosterRisk } from "../../services/risk.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";

const router = Router();

const scoreSchema = z.object({
  studentId: z.string().min(1),
  rawScore: z.number().min(0),
});
router.post(
  "/assessments/:id/score",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", scoreSchema),
  async (req, res, next) => {
    try {
      const assessment = await prisma.assessment.findUnique({
        where: { id: String(String(req.params.id)) },
        include: { gradeComponent: { include: { assessments: { include: { studentGrades: true } } } } },
      });
      if (!assessment) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment not found");

      // Enlisted students without accounts score under `roster:<id>`. The
      // roster entry must sit in a section where the caller teaches this
      // subject + term.
      const rawStudentId = String(req.body.studentId);
      const isRoster = rawStudentId.startsWith("roster:");
      const rosterId = isRoster ? rawStudentId.slice("roster:".length) : null;
      const rosterEntry = isRoster
        ? await prisma.studentRoster.findUnique({
            where: { id: rosterId as string },
            select: { id: true, sectionId: true, section: { select: { name: true } } },
          })
        : null;
      if (isRoster && !rosterEntry) {
        throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
      }
      // Section + category for the realtime confirmation message.
      const sectionName = isRoster
        ? (rosterEntry!.section?.name ?? "")
        : (
            await prisma.studentProfile.findUnique({
              where: { userId: rawStudentId },
              select: { section: { select: { name: true } } },
            })
          )?.section?.name ?? "";
      const gc = assessment.gradeComponent;
      if (isRoster) {
        const coverage = await prisma.teacherSubjectAssignment.findFirst({
          where: {
            teacherId: req.user!.id,
            subjectId: gc.subjectId,
            termId: gc.termId,
            sectionId: rosterEntry!.sectionId,
          },
          select: { id: true },
        });
        if (!coverage) {
          throw new AppError(403, "FORBIDDEN", "Student is not in your class for this subject");
        }
      }

      const percentage = (req.body.rawScore / assessment.maxScore) * 100;
      if (isRoster) {
        await prisma.studentGrade.upsert({
          where: { assessmentId_rosterId: { assessmentId: assessment.id, rosterId: rosterId as string } },
          create: { assessmentId: assessment.id, studentId: null, rosterId: rosterId as string, rawScore: req.body.rawScore, percentageScore: percentage },
          update: { rawScore: req.body.rawScore, percentageScore: percentage },
        });
      } else {
        await prisma.studentGrade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: rawStudentId } },
          create: { assessmentId: assessment.id, studentId: rawStudentId, rawScore: req.body.rawScore, percentageScore: percentage },
          update: { rawScore: req.body.rawScore, percentageScore: percentage },
        });
      }

      // Recompute final grade for this student/subject/term (shared helper —
      // identical math everywhere finals are recomputed).
      const key = isRoster ? { rosterId: rosterId as string } : { studentId: rawStudentId };
      const final = await recomputeSubjectFinal(key, gc.subjectId, gc.termId);
      // Unreachable: a score was just stored, so at least one category has
      // evidence and the recompute always yields a grade.
      if (!final) {
        throw new AppError(500, "RECOMPUTE_FAILED", "Could not recompute the final grade");
      }
      const { computedAverage, transmutedGrade, remarks } = final;

      // Risk + parent notifications only apply to registered profiles.
      // Roster students get the roster risk path (snapshot + auto-intervention).
      if (!isRoster) {
        const term = await prisma.term.findFirst({ where: { id: gc.termId } });
        if (term) await recomputeRisk(rawStudentId, term.id);
      } else {
        await recomputeRosterRisk(rosterId as string, gc.termId);
      }
      // Finals feed cached teacher / registrar / principal views.
      await invalidateTags(["teacher", "registrar", "academics", "overview", "principal", "risk", "guidance"]);

      // True realtime confirmation to the teacher who saved: one inbox row
      // per assessment per minute (60s dedup on user + source + action) so
      // a save-all batch lands as a single bell + toast, not one per score.
      // Names the section and category the scores belong to, in sentence form.
      const categoryName =
        gc.componentType === "WRITTEN_WORK"
          ? "Written Work"
          : gc.componentType === "PERFORMANCE_TASK"
            ? "Performance Task"
            : "Exam";

      res.json({ computedAverage, transmutedGrade, remarks });
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "student_grades",
        action: "score_self",
        sourceId: assessment.id,
        message: `You saved scores for ${assessment.title} (${categoryName}) in ${sectionName}.`,
      });
    } catch (e) { next(e); }
  }
);

router.get(
  "/students/:id/final-grades",
  requireAuth,
  requireOwnershipOrRole(async (req) => String(String(req.params.id)), "principal", "adviser", "subject_teacher", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const grades = await prisma.finalGrade.findMany({
        where: { studentId: String(String(req.params.id)) },
        include: { subject: true, term: true },
        orderBy: { termId: "asc" },
      });
      res.json(grades);
    } catch (e) { next(e); }
  }
);

const lockSchema = z.object({});
router.post(
  "/final-grades/:id/lock",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (req.termScope?.termId && fg.termId !== req.termScope.termId) {
        throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found in the active term");
      }
      if (fg.lockStatus !== "unlocked") throw new AppError(409, "ALREADY_LOCKED", "Final already locked");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "locked", lockedBy: req.user!.id, lockedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Subject teacher submitted final grade for adviser approval" });
      await invalidateTags(["registrar", "registrar-finals", "registrar-overview", "academics", "overview", "principal", "risk", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// Stage 2 — adviser approves the subject teacher's locked final, passing it to
// the registrar/record keeper for final validation.
router.post(
  "/final-grades/:id/adviser-approve",
  requireAuth,
  requireRole("adviser"),
  gradeBandGuard(async (req) => {
    const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) }, select: { studentId: true, rosterId: true } });
    if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
    return fg.studentId ?? (fg.rosterId ? `roster:${fg.rosterId}` : "");
  }),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (req.termScope?.termId && fg.termId !== req.termScope.termId) {
        throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found in the active term");
      }
      if (fg.lockStatus !== "locked") throw new AppError(409, "NOT_LOCKED", "Final must be locked by the subject teacher before adviser approval");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "adviser_approved", adviserApprovedBy: req.user!.id, adviserApprovedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Adviser approved final grade" });
      await invalidateTags(["registrar", "registrar-finals", "registrar-overview", "academics", "overview", "principal", "risk", "teacher"]);
      res.json(updated);

      // Registrar desk handoff (best-effort): when this approval completes the
      // student's term set (every final in the term is adviser_approved), the
      // grade-band owner learns the set is viewable. Partial approvals stay
      // silent. The 60s message-aware dedup in fanoutNotification absorbs
      // double-fires from rapid successive approvals.
      void (async () => {
        try {
          const full = await prisma.finalGrade.findUnique({
            where: { id: fg.id },
            select: {
              termId: true,
              studentId: true,
              rosterId: true,
              term: { select: { termNumber: true, schoolYear: { select: { name: true } } } },
              student: {
                select: {
                  gradeLevel: true,
                  lrn: true,
                  section: { select: { name: true } },
                  user: { select: { fullName: true } },
                },
              },
              roster: { select: { gradeLevel: true, lrn: true, fullName: true, section: { select: { name: true } } } },
            },
          });
          if (!full) return;
          const gradeLevel = full.student?.gradeLevel ?? full.roster?.gradeLevel ?? null;
          const name = full.student?.user.fullName ?? full.roster?.fullName ?? "A student";
          const section = full.student?.section?.name ?? full.roster?.section?.name ?? "—";
          const remaining = await prisma.finalGrade.count({
            where: {
              termId: full.termId,
              ...(full.studentId ? { studentId: full.studentId } : { rosterId: full.rosterId }),
              NOT: { lockStatus: "adviser_approved" },
            },
          });
          if (remaining > 0) return;
          const bandRole =
            gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10"
              ? "record_keeper"
              : "registrar";
          const termLabel = `${full.term.schoolYear.name.split(" ")[0]} T${full.term.termNumber}`;
          await fanoutToRole(bandRole, {
            sourceTable: "final_grades",
            action: "adviser_approved",
            message: `Finals ready: ${name} (${section}) — ${termLabel}, all subjects adviser-approved.`,
            sourceId: fg.id,
            excludeUserId: req.user!.id,
          });
        } catch {
          // Best-effort only — approval already succeeded.
        }
      })();
    } catch (e) { next(e); }
  }
);

export default router;
