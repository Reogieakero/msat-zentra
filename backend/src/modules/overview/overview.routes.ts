import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  sectionHeadcounts,
  totalRosterHeadcount,
} from "../../services/enrollment.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import {
  computeRiskFactors,
  isAtRisk,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { meetsAcademicExcellenceAward } from "../../services/grading.js";
import { GRADE_LABELS, GRADE_ORDER } from "../../lib/grades.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("principal"),
  cache({ tags: ["overview", "principal"] }),
  async (req, res, next) => {
    try {

      const schoolYearId =
        req.termScope?.schoolYearId ??
        (
          await prisma.schoolYear.findFirst({
            where: { isActive: true },
            select: { id: true },
          })
        )?.id;

      const termId = req.termScope?.termId ?? (await resolveActiveTermId(req));

      const [profiles, rosterExtra, activeSections, teachers, anecdotals, students, rosterCohort, admPipeline, admReferrals, accountApprovals, sectionPopulations] =
        await Promise.all([
          prisma.studentProfile.count(),

          totalRosterHeadcount(),
          prisma.section.count({ where: { adviserId: { not: null } } }),
          prisma.staffProfile.count(),
          prisma.anecdotalRecord.count(termId ? { where: { termId } } : undefined),
          prisma.studentProfile.findMany({
            where: schoolYearId ? { section: { schoolYearId } } : undefined,
            select: {
              lrn: true,
              gradeLevel: true,
              section: { select: { id: true, _count: { select: { students: true } } } },
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

          prisma.studentRoster.findMany({
            where: schoolYearId ? { schoolYearId } : undefined,
            select: {
              lrn: true,
              gradeLevel: true,
              sectionId: true,
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

          prisma.referral.count({
            where: {
              referredToRole: "adm_coordinator",
              status: { in: ["pending", "in_progress"] },
              admProfiles: { none: {} },
            },
          }),
          prisma.user.count({ where: { status: "pending" } }),
          prisma.section.findMany({
            where: schoolYearId ? { schoolYearId } : undefined,
            select: { id: true, name: true, gradeLevel: true, _count: { select: { students: true } } },
            orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          }),
        ]);
      const admPending = admPipeline + admReferrals;

      const enrollment = profiles + rosterExtra;

      const headcounts = await sectionHeadcounts(sectionPopulations.map((s) => s.id));

      const registeredLrns = new Set(students.map((s) => s.lrn));
      const riskCohort: {
        gradeLevel: string;
        sectionId: string;
        enrolledFallback: number;
        finalGrades: {
          computedAverage: number | null;
          transmutedGrade: number | null;
          lockStatus: string;
          finalizedAt: Date | null;
        }[];
        attendanceRecords: { status: string }[];
        anecdotalCount: number;
      }[] = [
        ...students.map((s) => ({
          gradeLevel: s.gradeLevel,
          sectionId: s.section?.id ?? "",
          enrolledFallback: s.section?._count.students ?? 0,
          finalGrades: s.finalGrades,
          attendanceRecords: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
        })),
        ...rosterCohort
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => ({
            gradeLevel: r.gradeLevel,
            sectionId: r.sectionId,
            enrolledFallback: 0,
            finalGrades: r.finalGrades,
            attendanceRecords: r.attendanceRecords,
            anecdotalCount: r.anecdotalRecords.length,
          })),
      ];

      let attendance = 0;
      let grades = 0;
      let behavior = 0;
      let atRiskStudents = 0;
      let honorRoll = 0;
      const riskByLevel = { high: 0, moderate: 0, low: 0 };
      const riskByGrade = new Map<string, number>();
      for (const s of riskCohort) {
        const flags = computeRiskFactors({
          finalGrades: s.finalGrades,
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalCount,
          enrolled: headcounts.get(s.sectionId) ?? s.enrolledFallback,
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
          if (meetsAcademicExcellenceAward(avg, lowest)) honorRoll++;
        }
      }

      const atRisk = { attendance, grades, behavior, students: atRiskStudents };

      const riskByGradeRows = GRADE_ORDER.map((g) => ({
        grade: GRADE_LABELS[g],
        count: riskByGrade.get(g) ?? 0,
      }));

      const sectionPopulationRows = sectionPopulations.map((s) => ({
        grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
        section: s.name,
        count: headcounts.get(s.id) ?? s._count.students,
      }));

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
