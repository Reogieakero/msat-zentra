import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

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

      const term = schoolYearId
        ? await prisma.term.findFirst({
            where: { schoolYearId },
            orderBy: { termNumber: "asc" },
            select: { id: true },
          })
        : null;
      const termId = term?.id;

      const [enrollment, activeSections, teachers, anecdotals, students, admPending, accountApprovals] =
        await Promise.all([
          prisma.studentProfile.count(),
          prisma.section.count({ where: { adviserId: { not: null } } }),
          prisma.staffProfile.count(),
          prisma.anecdotalRecord.count(termId ? { where: { termId } } : undefined),
          prisma.studentProfile.findMany({
            where: schoolYearId ? { section: { schoolYearId } } : undefined,
            select: {
              riskLevel: true,
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

      let attendance = 0;
      let grades = 0;
      let behavior = 0;
      let wellbeing = 0;
      let honorRoll = 0;
      for (const s of students) {
        const avg =
          s.finalGrades.length > 0
            ? s.finalGrades.reduce((sum, g) => sum + (g.transmutedGrade ?? 0), 0) /
              s.finalGrades.length
            : 100;
        const present = s.attendanceRecords.filter((a) => a.status === "present").length;
        const total = s.attendanceRecords.length;
        const attFlag = total > 0 && present / total < 0.8;
        const gradeFlag = avg < 75;
        const behFlag = s.anecdotalRecords.length > 0;
        if (attFlag) attendance++;
        if (gradeFlag) grades++;
        if (behFlag) behavior++;
        // Wellbeing = ADM learner profiles (handled separately via admPending pool);
        // count here only reflects behavioral+academic+attendance risk.
        if ((s.riskLevel === "High" || s.riskLevel === "Moderate") && avg >= 90 && !gradeFlag) {
          honorRoll++;
        }
      }
      wellbeing = admPending; // learners awaiting ADM signature are the wellbeing flag

      const atRisk = { attendance, grades, behavior, wellbeing };

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
