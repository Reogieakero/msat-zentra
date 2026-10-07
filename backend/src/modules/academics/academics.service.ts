import { prisma } from "../../lib/prisma.js";
import {
  remarksFromTransmuted,
  meetsAcademicExcellenceAward,
} from "../../services/grading.js";
import { computeRiskFactors, levelFromFlags } from "../../services/risk.js";
import { schoolDaysToDate } from "../../services/attendance.js";

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// DO 15, s. 2026 lists Academic Excellence awardees alphabetically — no
// bands, no rank order.

export interface AcademicsSummary {
  schoolYear: string;
  termLabel: string;
  sections: SectionSummaryDTO[];
  passFailByGrade: PassFailByGradeDTO[];
  honorRollPreview: HonorRollCandidateDTO[];
  potentialHonorRoll: PotentialHonorCandidateDTO[];
}

// Students not yet confirmed (grades still unlocked) but whose current raw
// partial grades already satisfy the Academic Excellence rule — i.e. they
// have the potential to make the award list once remaining grades are
// locked/finalized.
export interface PotentialHonorCandidateDTO {
  studentId: string;
  name: string;
  overallAverage: number;
  unlockedSubjects: number;
}

export interface StudentSubjectDTO {
  subject: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: "Passed" | "Failed";
}

export interface StudentRowDTO {
  studentId: string;
  lrn: string;
  name: string;
  riskLevel: "High" | "Moderate" | "Low";
  overallAverage: number;
  attendanceRatePct: number;
  presentAm: number;
  presentPm: number;
  schoolDays: number;
  subjects: StudentSubjectDTO[];
}

export interface SectionSummaryDTO {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  passPct: number;
  failPct: number;
  atRiskCount: number;
  students: StudentRowDTO[];
}

export interface PassFailByGradeDTO {
  grade: string;
  passed: number;
  failed: number;
}

export interface HonorRollCandidateDTO {
  studentId: string;
  name: string;
  overallAverage: number;
}

export async function getAcademicsSummary(
  mode: "raw" | "final" = "final",
  scope?: { schoolYearId?: string | null; termId?: string | null },
): Promise<AcademicsSummary> {
  // Scoped to the session's active School Year + Term (req.termScope).
  // Falls back to the database-active year so legacy callers keep working.
  let activeTerm: {
    id: string;
    termNumber: number;
    startDate: Date | null;
    schoolYear: { name: string };
  } | null = null;
  if (scope?.termId) {
    activeTerm = await prisma.term.findUnique({
      where: { id: scope.termId },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm && scope?.schoolYearId) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYearId: scope.schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  if (!activeTerm) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, startDate: true, schoolYear: { select: { name: true } } },
    });
  }
  const termId = activeTerm?.id;
  const termLabel = activeTerm ? `Term ${activeTerm.termNumber}` : "No active term";
  const schoolYear = activeTerm?.schoolYear?.name ?? "No active school year";
  // Global "school days done" — weekdays from term start through today.
  // Single source of truth shared with the attendance heatmaps.
  const schoolDays = schoolDaysToDate(activeTerm?.startDate);

  // "final" = only locked/finalized grades; "raw" = include every graded row
  // (locked or not) so the principal can preview before grades are finalized.
  const lockedOnly = mode === "final";

  // Scope sections to the active school year (was: all years, all sections).
  // Falls back to the DB-active year when the session carries no scope.
  let resolvedYearId = scope?.schoolYearId ?? null;
  if (!resolvedYearId) {
    const activeYear = await prisma.schoolYear.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    resolvedYearId = activeYear?.id ?? null;
  }

  const sections = await prisma.section.findMany({
    where: resolvedYearId ? { schoolYearId: resolvedYearId } : undefined,
    include: {
      students: {
        include: {
          user: { select: { fullName: true } },
          finalGrades: {
            where: termId ? { termId } : undefined,
            select: {
              termId: true,
              transmutedGrade: true,
              computedAverage: true,
              remarks: true,
              lockStatus: true,
              finalizedAt: true,
              subject: { select: { name: true } },
            },
          },
          attendanceRecords: {
            where: { termId },
            select: { status: true, session: true, date: true },
          },
          anecdotalRecords: {
            where: { termId },
            select: { id: true },
          },
        },
      },
      // Enlisted students without accounts — account status never excludes
      // anyone from academics or risk. Same shape as profiles below.
      rosterEntries: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          finalGrades: {
            where: { termId },
            select: {
              termId: true,
              transmutedGrade: true,
              computedAverage: true,
              remarks: true,
              lockStatus: true,
              finalizedAt: true,
              subject: { select: { name: true } },
            },
          },
          attendanceRecords: {
            where: { termId },
            select: { status: true, session: true, date: true },
          },
          anecdotalRecords: {
            where: { termId },
            select: { id: true },
          },
        },
      },
    },
  });

  const sectionSummaries: SectionSummaryDTO[] = [];
  const passFailMap = new Map<string, { passed: number; failed: number }>();
  const honorRollPool: HonorRollCandidateDTO[] = [];
  const potentialPool: PotentialHonorCandidateDTO[] = [];

  for (const section of sections) {
    const grade = gradeLabel(section.gradeLevel);
    const gradeAcc = passFailMap.get(grade) ?? { passed: 0, failed: 0 };

    // Registered profiles plus unregistered enlistments (matched by LRN so
    // nobody counts twice once they register), normalized to one shape.
    const registeredLrns = new Set(section.students.map((s) => s.lrn));
    const enrolledStudents: {
      userId: string;
      lrn: string;
      fullName: string;
      finalGrades: {
        termId: string | null;
        transmutedGrade: number | null;
        computedAverage: number | null;
        remarks: string | null;
        lockStatus: string;
        finalizedAt: Date | null;
        subject: { name: string };
      }[];
      attendanceRecords: { status: string; session: string; date: Date }[];
      anecdotalCount: number;
    }[] = [
      ...section.students.map((s) => ({
        userId: s.userId,
        lrn: s.lrn,
        fullName: s.user.fullName,
        finalGrades: s.finalGrades,
        attendanceRecords: s.attendanceRecords,
        anecdotalCount: s.anecdotalRecords.length,
      })),
      ...section.rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => ({
          userId: `roster:${r.id}`,
          lrn: r.lrn,
          fullName: r.fullName,
          finalGrades: r.finalGrades,
          attendanceRecords: r.attendanceRecords,
          anecdotalCount: r.anecdotalRecords.length,
        })),
    ];
    const enrolled = enrolledStudents.length;

    const students: StudentRowDTO[] = [];
    for (const student of enrolledStudents) {
      const finals = (student.finalGrades ?? [])
        .filter((f) => f.termId === termId)
        .filter((f) =>
          lockedOnly
            ? f.lockStatus === "locked" || f.lockStatus === "adviser_approved" || f.finalizedAt != null
            : true
        )
        .filter((f) => f.transmutedGrade != null && f.computedAverage != null);
      // Every name on the advisory roster (registered profile or enlisted
      // roster entry) is listed — account or grade status never excludes
      // anyone. Students without encoded grades get an empty subject list.
      const hasGrades = finals.length > 0;

      const subjects: StudentSubjectDTO[] = finals.map((f) => {
        const transmutedGrade = f.transmutedGrade as number;
        return {
          subject: f.subject.name,
          computedAverage: round1(f.computedAverage as number),
          transmutedGrade,
          remarks: (f.remarks ?? remarksFromTransmuted(transmutedGrade)) as
            | "Passed"
            | "Failed",
        };
      });

      const overallAverage = hasGrades
        ? round1(
            subjects.reduce((a, s) => a + s.transmutedGrade, 0) / subjects.length
          )
        : 0;

      // Pass/fail only counts students with encoded grades.
      if (hasGrades) {
        if (overallAverage >= 75) gradeAcc.passed += 1;
        else gradeAcc.failed += 1;
      }

      // Live risk level via the shared engine (do NOT trust the stale stored
      // riskLevel column — must match the Risk board/students pages).
      const liveLevel = levelFromFlags(
        computeRiskFactors({
          finalGrades: finals.map((f) => ({
            computedAverage: f.computedAverage,
            transmutedGrade: f.transmutedGrade,
          })),
          attendance: student.attendanceRecords,
          anecdotalCount: student.anecdotalCount,
          enrolled,
        })
      );
      const atRisk = liveLevel === "High" || liveLevel === "Moderate";

      const amRecords = student.attendanceRecords.filter((a) => a.session === "AM");
      const pmRecords = student.attendanceRecords.filter((a) => a.session === "PM");
      const presentAm = amRecords.filter((a) => a.status === "present").length;
      const presentPm = pmRecords.filter((a) => a.status === "present").length;
      const totalRecords = student.attendanceRecords.length;
      const attendanceRatePct = totalRecords > 0
        ? round1((presentAm + presentPm) / totalRecords * 100)
        : 0;

      students.push({
        studentId: student.userId,
        lrn: student.lrn,
        name: student.fullName,
        riskLevel: liveLevel,
        overallAverage,
        attendanceRatePct,
        presentAm,
        presentPm,
        schoolDays,
        subjects,
      });

      // Academic Excellence (DO 15, s. 2026): only students with encoded
      // grades, every subject grade locked/finalized, and the student is not
      // High risk.
      if (hasGrades) {
        const allLocked = finals.every(
          (f) => f.lockStatus === "locked" || f.lockStatus === "adviser_approved" || f.finalizedAt != null
        );
        if (allLocked && liveLevel !== "High") {
          const lowestSubject = subjects.reduce(
            (min, s) => Math.min(min, s.transmutedGrade),
            Infinity
          );
          if (meetsAcademicExcellenceAward(overallAverage, lowestSubject)) {
            honorRollPool.push({
              studentId: student.userId,
              name: student.fullName,
              overallAverage,
            });
          }
        } else if (!allLocked && liveLevel !== "High") {
          // Potential engine: current raw partial grades already meet the
          // award rule, so the student can still reach the award list once
          // remaining grades are locked.
          const lowestSubject = subjects.reduce(
            (min, s) => Math.min(min, s.transmutedGrade),
            Infinity
          );
          if (meetsAcademicExcellenceAward(overallAverage, lowestSubject)) {
            const unlockedSubjects = finals.filter(
              (f) =>
                f.lockStatus !== "locked" &&
                f.lockStatus !== "adviser_approved" &&
                f.finalizedAt == null
            ).length;
            potentialPool.push({
              studentId: student.userId,
              name: student.fullName,
              overallAverage,
              unlockedSubjects,
            });
          }
        }
      }
    }

    passFailMap.set(grade, gradeAcc);

    // Section aggregates only cover students with encoded grades, so
    // gradeless roster members never drag averages or pass rates. Sections
    // are always listed, even when nobody has grades yet.
    const graded = students.filter((s) => s.subjects.length > 0);
    const avgTransmuted =
      graded.length > 0
        ? round1(
            graded.reduce((a, s) => a + s.overallAverage, 0) / graded.length
          )
        : 0;
    const failed = graded.filter((s) => s.overallAverage < 75).length;
    const failPct =
      graded.length > 0 ? round1((failed / graded.length) * 100) : 0;
    const passPct = graded.length > 0 ? round1(100 - failPct) : 0;
    const atRiskCount = students.filter(
      (s) => s.riskLevel === "High" || s.riskLevel === "Moderate"
    ).length;

    sectionSummaries.push({
      sectionId: section.id,
      section: section.name,
      grade,
      avgTransmuted,
      passPct,
      failPct,
      atRiskCount,
      students,
    });
  }

  const passFailByGrade: PassFailByGradeDTO[] = Array.from(
    passFailMap.entries()
  )
    .map(([grade, acc]) => ({ grade, ...acc }))
    .sort(
      (a, b) =>
        Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, ""))
    );

  // DO 15, s. 2026: awardees are listed alphabetically.
  const honorRollPreview = honorRollPool
    .sort((a, b) => a.name.localeCompare(b.name));

  const potentialHonorRoll = potentialPool
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    schoolYear,
    termLabel,
    sections: sectionSummaries,
    passFailByGrade,
    honorRollPreview,
    potentialHonorRoll,
  };
}
