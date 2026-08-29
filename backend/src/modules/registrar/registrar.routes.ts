import { Router } from "express";
import { GradeLevel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

// Registrar overview (G11–G12 authority only). Every query is scoped to the
// registrar grade band so counts/lists never leak lower-grade data. All values
// are computed live from the database — no mocked data.
router.get(
  "/overview",
  requireAuth,
  requireRole("registrar", "record_keeper"),
  cache({ tags: ["registrar", "overview"] }),
  async (_req, res, next) => {
    try {
      const GRADE_BAND: GradeLevel[] = ["G11", "G12"];

      // pendingAccounts: total pending users awaiting account approval.
      const pendingAccounts = await prisma.user.count({
        where: { status: "pending" },
      });

      // pendingAdviserAccess: adviser staff accounts whose User is still pending.
      const pendingAdviserAccess = await prisma.staffProfile.count({
        where: { isAdviser: true, user: { status: "pending" } },
      });

      // lockedFinalsAwaiting: locked final grades for G11–12 students that are
      // awaiting registrar release/approval.
      const lockedFinalsAwaiting = await prisma.finalGrade.count({
        where: { lockStatus: "locked", student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // sf10Released: released SF10 records for G11–12 students.
      const sf10Released = await prisma.sf10Record.count({
        where: { status: "released", student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // sections: active-year G11–12 sections.
      const sections = await prisma.section.count({
        where: { gradeLevel: { in: GRADE_BAND }, schoolYear: { isActive: true } },
      });

      // subjects: G11–12 subjects.
      const subjects = await prisma.subject.count({
        where: { gradeLevel: { in: GRADE_BAND } },
      });

      // reportCards: every final-grade row for G11–12 students (one row ≈ one
      // report-card subject entry). Used as a proxy since there is no dedicated
      // "report card" model.
      const reportCards = await prisma.finalGrade.count({
        where: { student: { gradeLevel: { in: GRADE_BAND } } },
      });

      // latestAttachments: most recent SF10 records in "attach" status (G11–12).
      // Sf10Record has no updatedAt, so order by validatedAt (nullable) desc.
      const latestAttachRows = await prisma.sf10Record.findMany({
        where: { status: "attach", student: { gradeLevel: { in: GRADE_BAND } } },
        orderBy: { validatedAt: "desc" },
        take: 7,
        select: {
          validatedAt: true,
          student: {
            select: { lrn: true, gradeLevel: true, user: { select: { fullName: true } } },
          },
        },
      });
      const latestAttachments = latestAttachRows.map((r) => ({
        student: r.student.user.fullName,
        lrn: r.student.lrn,
        grade: gradeLabel(r.student.gradeLevel),
        // ISO timestamp — frontend formats it relative ("2m ago").
        when: (r.validatedAt ?? new Date(0)).toISOString(),
      }));

      // missingSf10: G11–12 students with NO sf10Record at all.
      const missingRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, sf10Records: { none: {} } },
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      });
      const missingSf10 = missingRows.map((s) => ({
        student: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
      }));

      // pendingStudents: G11–12 students whose User is still pending (newly
      // enrolled awaiting approval). Include first linked parent fullName.
      const pendingStudentRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, user: { status: "pending" } },
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
          parentLinks: {
            take: 1,
            select: { parent: { select: { user: { select: { fullName: true } } } } },
          },
        },
      });
      const pendingStudents = pendingStudentRows.map((s) => ({
        name: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
        parent: s.parentLinks[0]?.parent.user.fullName ?? "—",
      }));

      // sf10Students: G11–12 students who have an SF10 record (any status), take 5.
      const sf10StudentRows = await prisma.studentProfile.findMany({
        where: { gradeLevel: { in: GRADE_BAND }, sf10Records: { some: {} } },
        take: 5,
        select: {
          lrn: true,
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      });
      const sf10Students = sf10StudentRows.map((s) => ({
        name: s.user.fullName,
        lrn: s.lrn,
        grade: gradeLabel(s.gradeLevel),
      }));

      res.json({
        pendingAccounts,
        pendingAdviserAccess,
        lockedFinalsAwaiting,
        sf10Released,
        sections,
        subjects,
        reportCards,
        latestAttachments,
        missingSf10,
        pendingStudents,
        sf10Students,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
