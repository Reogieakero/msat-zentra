import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  computeRiskFactors,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";

const router = Router();

const TEACHER_ROLES = ["subject_teacher", "adviser"] as const;

// Pure gate: adviser-only surfaces 404 unless the teacher advises ≥1 section.
// Throws AppError so it stays unit-testable without a DB.
export function requireAdvisorySections<T extends { id: string }>(sections: T[]): T[] {
  if (sections.length === 0) {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  return sections;
}

async function adviserSectionsOr404(teacherId: string) {
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true, name: true, gradeLevel: true },
  });
  return requireAdvisorySections(sections);
}

// GET /api/teacher/advisory/students — advisee roster with risk chips.
// Adviser-only (404 otherwise). No anecdotal content, ever — counts and
// confidentiality tiers only.
router.get(
  "/students",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await adviserSectionsOr404(teacherId);
      const termId = await resolveActiveTermId();
      if (!termId) {
        return res.json({ advisorySections: sections, termId: null, students: [] });
      }

      const sectionIds = sections.map((s) => s.id);
      const [counts, advisees] = await Promise.all([
        prisma.studentProfile.groupBy({
          by: ["sectionId"],
          where: { sectionId: { in: sectionIds } },
          _count: { _all: true },
        }),
        prisma.studentProfile.findMany({
          where: { sectionId: { in: sectionIds } },
          include: {
            user: { select: { fullName: true } },
            section: { select: { id: true, name: true } },
            finalGrades: {
              where: { termId },
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: { where: { termId }, select: { status: true } },
            anecdotalRecords: {
              where: { termId },
              select: { confidentialityLevel: true, category: true },
            },
            gradeFlags: { select: { status: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        }),
      ]);
      const enrolledBySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));

      const students = advisees.map((s) => {
        const enrolled = enrolledBySection.get(s.sectionId!) ?? 0;
        const factors = computeRiskFactors({
          finalGrades: s.finalGrades,
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
          enrolled,
        });
        const activeFlags: ("academic" | "attendance" | "behavioral")[] = [];
        if (factors.academicFlag) activeFlags.push("academic");
        if (factors.attendanceFlag) activeFlags.push("attendance");
        if (factors.behavioralFlag) activeFlags.push("behavioral");
        const present = s.attendanceRecords.filter((r) => r.status === "present").length;
        const total = s.attendanceRecords.length;
        const openFlags = s.gradeFlags.filter((g) => g.status !== "resolved").length;
        return {
          studentId: s.userId,
          name: s.user.fullName,
          lrn: s.lrn,
          birthdate: s.birthdate,
          gender: s.gender,
          section: s.section?.name ?? "",
          riskLevel: levelFromFlags(factors),
          flags: activeFlags,
          attendanceRate: total === 0 ? 1 : present / total,
          anecdotalCount: s.anecdotalRecords.length,
          confidentialityTiers: Array.from(
            new Set(s.anecdotalRecords.map((a) => a.confidentialityLevel))
          ),
          hasOpenFlag: openFlags > 0,
          openFlagCount: openFlags,
        };
      });

      res.json({ advisorySections: sections, termId, students });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/teacher/advisory/students/:id — drawer detail for one advisee.
// 404 unless the student is in the caller's advisory section. Referrals and
// ADM come back status/stage-only; anecdotal content is never included.
router.get(
  "/students/:id",
  requireAuth,
  requireRole(...TEACHER_ROLES),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const studentId = String(req.params.id);
      const termId = await resolveActiveTermId();
      if (!termId) {
        throw new AppError(404, "NO_ACTIVE_TERM", "No active term");
      }

      const student = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        include: {
          user: { select: { fullName: true } },
          section: { select: { id: true, name: true, gradeLevel: true, adviserId: true } },
          finalGrades: {
            where: { termId },
            include: { subject: { select: { id: true, name: true } } },
          },
          attendanceRecords: { where: { termId }, select: { status: true } },
          anecdotalRecords: {
            where: { termId },
            select: { confidentialityLevel: true, category: true },
          },
          referrals: {
            where: { termId },
            select: { id: true, referredToRole: true, status: true },
            orderBy: { id: "desc" },
          },
          admProfiles: {
            where: { termId },
            select: { id: true, stage: true, eligibilityStatus: true },
          },
          gradeFlags: {
            include: {
              subject: { select: { id: true, name: true } },
              raisedByUser: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!student || student.section?.adviserId !== teacherId) {
        throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
      }

      const present = student.attendanceRecords.filter((r) => r.status === "present").length;
      const absent = student.attendanceRecords.filter((r) => r.status === "absent").length;
      const late = student.attendanceRecords.filter((r) => r.status === "late").length;
      const excused = student.attendanceRecords.filter((r) => r.status === "excused").length;
      const total = student.attendanceRecords.length;

      res.json({
        studentId: student.userId,
        name: student.user.fullName,
        lrn: student.lrn,
        birthdate: student.birthdate,
        gender: student.gender,
        section: student.section.name,
        gradeLevel: student.section.gradeLevel,
        grades: student.finalGrades.map((g) => ({
          subject: g.subject.name,
          computedAverage: g.computedAverage,
          transmutedGrade: g.transmutedGrade,
          remarks: g.remarks,
          lockStatus: g.lockStatus,
        })),
        attendance: {
          rate: total === 0 ? 1 : present / total,
          present,
          absent,
          late,
          excused,
          total,
        },
        anecdotal: {
          count: student.anecdotalRecords.length,
          tiers: Array.from(new Set(student.anecdotalRecords.map((a) => a.confidentialityLevel))),
          categories: Array.from(new Set(student.anecdotalRecords.map((a) => a.category))),
        },
        referrals: student.referrals.map((r) => ({
          id: r.id,
          target: r.referredToRole,
          status: r.status,
        })),
        admCases: student.admProfiles.map((a) => ({
          id: a.id,
          stage: a.stage,
          eligibility: a.eligibilityStatus,
        })),
        gradeFlags: student.gradeFlags.map((f) => ({
          id: f.id,
          reason: f.reason,
          note: f.note,
          status: f.status,
          subject: f.subject.name,
          raisedBy: f.raisedByUser.fullName,
          createdAt: f.createdAt,
          resolutionNote: f.resolutionNote,
          resolvedAt: f.resolvedAt,
        })),
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
