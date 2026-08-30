import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole, requireOwnershipOrRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { gradeBandGuard } from "../../middleware/gradeBand.js";
import { validate } from "../../middleware/validate.js";
import { computeFinalGrade } from "../../services/grading.js";
import { recomputeRisk } from "../../services/risk.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";

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

      const percentage = (req.body.rawScore / assessment.maxScore) * 100;
      await prisma.studentGrade.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: req.body.studentId } },
        create: { assessmentId: assessment.id, studentId: req.body.studentId, rawScore: req.body.rawScore, percentageScore: percentage },
        update: { rawScore: req.body.rawScore, percentageScore: percentage },
      });

      // Recompute final grade for this student/subject/term
      const gc = assessment.gradeComponent;
      const components = await prisma.gradeComponent.findMany({
        where: { subjectId: gc.subjectId, termId: gc.termId },
        include: { assessments: { include: { studentGrades: { where: { studentId: req.body.studentId } } } } },
      });
      const componentAverages = components.map((c) => {
        const grades = c.assessments.flatMap((a) => a.studentGrades);
        const avg = grades.length ? grades.reduce((s, g) => s + g.percentageScore, 0) / grades.length : 0;
        return { weightPercentage: c.weightPercentage, average: avg };
      });
      const { computedAverage, transmutedGrade, remarks } = computeFinalGrade(componentAverages);

      await prisma.finalGrade.upsert({
        where: { studentId_subjectId_termId: { studentId: req.body.studentId, subjectId: gc.subjectId, termId: gc.termId } },
        create: { studentId: req.body.studentId, subjectId: gc.subjectId, termId: gc.termId, computedAverage, transmutedGrade, remarks },
        update: { computedAverage, transmutedGrade, remarks },
      });

      const term = await prisma.term.findFirst({ where: { id: gc.termId } });
      if (term) await recomputeRisk(req.body.studentId, term.id);

      res.json({ computedAverage, transmutedGrade, remarks });
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
      if (fg.lockStatus !== "unlocked") throw new AppError(409, "ALREADY_LOCKED", "Final already locked");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "locked", lockedBy: req.user!.id, lockedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Subject teacher submitted final grade for adviser approval" });
      await invalidateTags(["registrar", "academics", "overview", "principal", "risk"]);
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
    const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) }, select: { studentId: true } });
    if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
    return fg.studentId;
  }),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (fg.lockStatus !== "locked") throw new AppError(409, "NOT_LOCKED", "Final must be locked by the subject teacher before adviser approval");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { lockStatus: "adviser_approved", adviserApprovedBy: req.user!.id, adviserApprovedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Adviser approved final grade" });
      await invalidateTags(["registrar", "academics", "overview", "principal", "risk"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.post(
  "/final-grades/:id/registrar-approve",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  gradeBandGuard(async (req) => {
    const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) }, select: { studentId: true } });
    if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
    return fg.studentId;
  }),
  async (req, res, next) => {
    try {
      const fg = await prisma.finalGrade.findUnique({ where: { id: String(String(req.params.id)) } });
      if (!fg) throw new AppError(404, "FINAL_NOT_FOUND", "Final grade not found");
      if (fg.lockStatus !== "adviser_approved") throw new AppError(409, "NOT_ADVISER_APPROVED", "Final must be adviser-approved before registrar final approval");
      const updated = await prisma.finalGrade.update({
        where: { id: fg.id },
        data: { finalizedBy: req.user!.id, finalizedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "grade_lock", sourceTable: "final_grades", sourceId: fg.id, reason: "Registrar approved/validated final grade" });
      await invalidateTags(["registrar", "academics", "overview", "principal", "risk"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

export default router;
