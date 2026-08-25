import { prisma } from "../../lib/prisma.js";
import {
  remarksFromTransmuted,
  classifyHonorRoll,
  type HonorRollTier,
} from "../../services/grading.js";
import { computeRiskFactors, levelFromFlags } from "../../services/risk.js";

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

// DepEd honor roll bands use the general average and the lowest subject grade.
const TIER_RANK: Record<HonorRollTier, number> = {
  "Highest Honors": 3,
  "High Honors": 2,
  "With Honors": 1,
};

export interface AcademicsSummary {
  termLabel: string;
  sections: SectionSummaryDTO[];
  passFailByGrade: PassFailByGradeDTO[];
  honorRollPreview: HonorRollCandidateDTO[];
  potentialHonorRoll: PotentialHonorCandidateDTO[];
}

// Students not yet confirmed (grades still unlocked) but whose current raw
// partial grades already satisfy a DepEd honor band — i.e. they have the
// potential to make the honor roll once remaining grades are locked/finalized.
export interface PotentialHonorCandidateDTO {
  studentId: string;
  name: string;
  overallAverage: number;
  tier: HonorRollTier;
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
  tier: HonorRollTier;
}

export async function getAcademicsSummary(): Promise<AcademicsSummary> {
  const activeTerm = await prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true },
  });
  const termId = activeTerm?.id;
  const termLabel = activeTerm ? `Term ${activeTerm.termNumber}` : "No active term";

  const sections = await prisma.section.findMany({
    include: {
      students: {
        include: {
          user: { select: { fullName: true } },
          finalGrades: {
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
            select: { status: true },
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

    const students: StudentRowDTO[] = [];
    for (const student of section.students) {
      const finals = (student.finalGrades ?? [])
        .filter((f) => f.termId === termId)
        .filter((f) => f.transmutedGrade != null && f.computedAverage != null);
      if (finals.length === 0) continue;

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

      const overallAverage = round1(
        subjects.reduce((a, s) => a + s.transmutedGrade, 0) / subjects.length
      );

      if (overallAverage >= 75) gradeAcc.passed += 1;
      else gradeAcc.failed += 1;

      // Live risk level via the shared engine (do NOT trust the stale stored
      // riskLevel column — must match the Risk board/students pages).
      const liveLevel = levelFromFlags(
        computeRiskFactors({
          finalGrades: finals.map((f) => ({ transmutedGrade: f.transmutedGrade })),
          attendance: student.attendanceRecords,
          anecdotalCount: student.anecdotalRecords.length,
        })
      );
      const atRisk = liveLevel === "High" || liveLevel === "Moderate";

      students.push({
        studentId: student.userId,
        lrn: student.lrn,
        name: student.user.fullName,
        riskLevel: liveLevel,
        overallAverage,
        attendanceRatePct: 0,
        subjects,
      });

      // Honor roll (DepEd): only when every subject grade is locked/finalized,
      // and the student is not High risk.
      const allLocked = finals.every(
        (f) => f.lockStatus === "locked" || f.finalizedAt != null
      );
      if (allLocked && liveLevel !== "High") {
        const lowestSubject = subjects.reduce(
          (min, s) => Math.min(min, s.transmutedGrade),
          Infinity
        );
        const tier = classifyHonorRoll(overallAverage, lowestSubject);
        if (tier) {
          honorRollPool.push({
            studentId: student.userId,
            name: student.user.fullName,
            overallAverage,
            tier,
          });
        }
      } else if (!allLocked && liveLevel !== "High") {
        // Potential engine: current raw partial grades already meet a band, so the
        // student can still reach the honor roll once remaining grades are locked.
        const lowestSubject = subjects.reduce(
          (min, s) => Math.min(min, s.transmutedGrade),
          Infinity
        );
        const tier = classifyHonorRoll(overallAverage, lowestSubject);
        if (tier) {
          const unlockedSubjects = finals.filter(
            (f) => f.lockStatus !== "locked" && f.finalizedAt == null
          ).length;
          potentialPool.push({
            studentId: student.userId,
            name: student.user.fullName,
            overallAverage,
            tier,
            unlockedSubjects,
          });
        }
      }
    }

    passFailMap.set(grade, gradeAcc);

    if (students.length === 0) continue;

    const avgTransmuted = round1(
      students.reduce((a, s) => a + s.overallAverage, 0) / students.length
    );
    const failed = students.filter((s) => s.overallAverage < 75).length;
    const failPct = round1((failed / students.length) * 100);
    const passPct = round1(100 - failPct);
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

  const honorRollPreview = honorRollPool
    .sort((a, b) => {
      const tierDiff = TIER_RANK[b.tier] - TIER_RANK[a.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.overallAverage - a.overallAverage;
    })
    .slice(0, 12);

  const potentialHonorRoll = potentialPool
    .sort((a, b) => {
      const tierDiff = TIER_RANK[b.tier] - TIER_RANK[a.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.overallAverage - a.overallAverage;
    })
    .slice(0, 12);

  return {
    termLabel,
    sections: sectionSummaries,
    passFailByGrade,
    honorRollPreview,
    potentialHonorRoll,
  };
}
