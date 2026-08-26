import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  computeRiskFactors,
  isAtRisk,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { classifyHonorRoll } from "../../services/grading.js";

const router = Router();

// Principal overview (O4): KPIs, at-risk factor breakdown, and the counts that
// drive the "Action Required" cards. All values are computed live from the
// database — no mocked data.
router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const schoolYearId = activeYear?.id;

      // Single active-term resolver, shared with the Risk endpoints so the
      // Overview's live recompute matches the board/heatmap/students exactly.
      const termId = await resolveActiveTermId();

      const [enrollment, activeSections, teachers, anecdotals, students, admPending, accountApprovals] =
        await Promise.all([
          prisma.studentProfile.count(),
          prisma.section.count({ where: { adviserId: { not: null } } }),
          prisma.staffProfile.count(),
          prisma.anecdotalRecord.count(termId ? { where: { termId } } : undefined),
          prisma.studentProfile.findMany({
            where: schoolYearId ? { section: { schoolYearId } } : undefined,
            select: {
              section: { select: { _count: { select: { students: true } } } },
              finalGrades: { where: termId ? { termId } : undefined, select: { transmutedGrade: true } },
              attendanceRecords: {
                where: termId ? { termId } : undefined,
                select: { status: true },
              },
              anecdotalRecords: {
                where: termId ? { termId } : undefined,
                select: { id: true },
              },
            },
          }),
          prisma.admLearnerProfile.count({ where: { approvedBy: null } }),
          prisma.user.count({ where: { status: "pending" } }),
        ]);

      // Live risk recompute via the shared engine so the Overview agrees with
      // the Risk board/students pages (stored riskLevel column is NOT trusted).
      let attendance = 0;
      let grades = 0;
      let behavior = 0;
      let atRiskStudents = 0;
      let honorRoll = 0;
      for (const s of students) {
        const flags = computeRiskFactors({
          finalGrades: s.finalGrades,
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
          enrolled: s.section?._count.students ?? 0,
        });
        if (flags.attendanceFlag) attendance++;
        if (flags.academicFlag) grades++;
        if (flags.behavioralFlag) behavior++;
        const level = levelFromFlags(flags);
        if (isAtRisk(level)) atRiskStudents++;
        // Honor roll eligibility uses the same DepEd classifier as the Academics
        // page (general average + lowest subject). A student classifies into a
        // tier if their current averages meet a DepEd band.
        const gGrades = s.finalGrades.map((g) => g.transmutedGrade ?? 100);
        const avg =
          gGrades.length > 0
            ? gGrades.reduce((sum, g) => sum + g, 0) / gGrades.length
            : 100;
        const lowest = gGrades.length > 0 ? Math.min(...gGrades) : 100;
        if (classifyHonorRoll(avg, lowest)) honorRoll++;
      }

      // Factor totals (counts of students triggering each flag) — these align
      // with the Risk board's factorTotals. No "wellbeing" pseudo-factor.
      const atRisk = { attendance, grades, behavior, students: atRiskStudents };

      // Sections with attendance below 80% (attendance watch).
      const sections = schoolYearId
        ? await prisma.section.findMany({
            where: { schoolYearId },
            select: {
              attendanceRecords: {
                where: termId ? { termId } : undefined,
                select: { status: true },
              },
            },
          })
        : [];
      const attendanceWatch = sections.filter((sec) => {
        const total = sec.attendanceRecords.length;
        const present = sec.attendanceRecords.filter((a) => a.status === "present").length;
        return total > 0 && present / total < 0.8;
      }).length;

      res.json({
        kpis: { enrollment, activeSections, teachers, anecdotals },
        atRisk,
        admPending,
        accountApprovals,
        attendanceWatch,
        honorRoll,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
