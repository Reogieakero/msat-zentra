import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
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
  cache({ tags: ["overview", "principal"] }),
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

      const [enrollment, activeSections, teachers, anecdotals, students, admPending, accountApprovals, sectionPopulations] =
        await Promise.all([
          prisma.studentProfile.count(),
          prisma.section.count({ where: { adviserId: { not: null } } }),
          prisma.staffProfile.count(),
          prisma.anecdotalRecord.count(termId ? { where: { termId } } : undefined),
          prisma.studentProfile.findMany({
            where: schoolYearId ? { section: { schoolYearId } } : undefined,
            select: {
              gradeLevel: true,
              section: { select: { _count: { select: { students: true } } } },
              finalGrades: { where: termId ? { termId } : undefined, select: { computedAverage: true, transmutedGrade: true, lockStatus: true, finalizedAt: true } },
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
          prisma.admLearnerProfile.count({
            where: { stage: { in: ["meeting_parents", "home_visitation", "certification", "principal_approval"] } },
          }),
          prisma.user.count({ where: { status: "pending" } }),
          prisma.section.findMany({
            where: schoolYearId ? { schoolYearId } : undefined,
            select: { name: true, gradeLevel: true, _count: { select: { students: true } } },
            orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          }),
        ]);

      // Live risk recompute via the shared engine so the Overview agrees with
      // the Risk board/students pages (stored riskLevel column is NOT trusted).
      let attendance = 0;
      let grades = 0;
      let behavior = 0;
      let atRiskStudents = 0;
      let honorRoll = 0;
      const riskByLevel = { high: 0, moderate: 0, low: 0 };
      const riskByGrade = new Map<string, number>();
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
        if (level === "High") riskByLevel.high++;
        else if (level === "Moderate") riskByLevel.moderate++;
        else riskByLevel.low++;
        if (isAtRisk(level)) {
          atRiskStudents++;
          const g = s.gradeLevel;
          riskByGrade.set(g, (riskByGrade.get(g) ?? 0) + 1);
        }
        // Honor roll uses the SAME rule as the Academics page: every subject
        // grade must be locked/finalized and the student must not be High risk.
        const finals = s.finalGrades;
        const allLocked =
          finals.length > 0 &&
          finals.every(
            (g) =>
              g.lockStatus === "locked" ||
              g.lockStatus === "adviser_approved" ||
              g.finalizedAt != null
          );
        if (allLocked && level !== "High") {
          const gGrades = finals.map((g) => g.transmutedGrade ?? 100);
          const avg = gGrades.reduce((sum, g) => sum + g, 0) / gGrades.length;
          const lowest = gGrades.length > 0 ? Math.min(...gGrades) : 100;
          if (classifyHonorRoll(avg, lowest)) honorRoll++;
        }
      }

      // Factor totals (counts of students triggering each flag) — these align
      // with the Risk board's factorTotals. No "wellbeing" pseudo-factor.
      const atRisk = { attendance, grades, behavior, students: atRiskStudents };

      // Risk-level split across all enrolled students (High / Moderate / Low)
      // plus the at-risk distribution per grade level, ordered G7 -> G12.
      const GRADE_LABELS: Record<string, string> = {
        G7: "Grade 7",
        G8: "Grade 8",
        G9: "Grade 9",
        G10: "Grade 10",
        G11: "Grade 11",
        G12: "Grade 12",
      };
      const GRADE_ORDER = Object.keys(GRADE_LABELS);
      const riskByGradeRows = GRADE_ORDER.map((g) => ({
        grade: GRADE_LABELS[g],
        count: riskByGrade.get(g) ?? 0,
      }));

      // Per-section population (enrolled students) for the active school year,
      // labelled by grade and ordered G7 -> G12 then section name.
      const sectionPopulationRows = sectionPopulations.map((s) => ({
        grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
        section: s.name,
        count: s._count.students,
      }));

      // Sections with attendance below 80% (attendance watch).
      const attendanceSections = schoolYearId
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
      const attendanceWatch = attendanceSections.filter((sec) => {
        const total = sec.attendanceRecords.length;
        const present = sec.attendanceRecords.filter((a) => a.status === "present").length;
        return total > 0 && present / total < 0.8;
      }).length;

      res.json({
        kpis: { enrollment, activeSections, teachers, anecdotals },
        atRisk,
        riskByLevel,
        riskByGrade: riskByGradeRows,
        sections: sectionPopulationRows,
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
