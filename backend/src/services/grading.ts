import { prisma } from "../lib/prisma.js";

// PLAN.md §6.1 — DepEd grade transmutation (60-100 scale).
// Maps a computed average (0-100) to the DepEd transmuted grade.
// Reference: DepEd Order No. 8, s. 2015 transmutation table. Each row is the
// INCLUSIVE lower bound of the initial-grade range for that transmuted grade
// (e.g. 60.00-61.59 -> 75, the lowest passing mark).
const TRANSMUTATION: { min: number; grade: number }[] = [
  { min: 100, grade: 100 },
  { min: 98.4, grade: 99 },
  { min: 96.8, grade: 98 },
  { min: 95.2, grade: 97 },
  { min: 93.6, grade: 96 },
  { min: 92.0, grade: 95 },
  { min: 90.4, grade: 94 },
  { min: 88.8, grade: 93 },
  { min: 87.2, grade: 92 },
  { min: 85.6, grade: 91 },
  { min: 84.0, grade: 90 },
  { min: 82.4, grade: 89 },
  { min: 80.8, grade: 88 },
  { min: 79.2, grade: 87 },
  { min: 77.6, grade: 86 },
  { min: 76.0, grade: 85 },
  { min: 74.4, grade: 84 },
  { min: 72.8, grade: 83 },
  { min: 71.2, grade: 82 },
  { min: 69.6, grade: 81 },
  { min: 68.0, grade: 80 },
  { min: 66.4, grade: 79 },
  { min: 64.8, grade: 78 },
  { min: 63.2, grade: 77 },
  { min: 61.6, grade: 76 },
  { min: 60.0, grade: 75 },
  { min: 56.0, grade: 74 },
  { min: 52.0, grade: 73 },
  { min: 48.0, grade: 72 },
  { min: 44.0, grade: 71 },
  { min: 40.0, grade: 70 },
  { min: 36.0, grade: 69 },
  { min: 32.0, grade: 68 },
  { min: 28.0, grade: 67 },
  { min: 24.0, grade: 66 },
  { min: 20.0, grade: 65 },
  { min: 16.0, grade: 64 },
  { min: 12.0, grade: 63 },
  { min: 8.0, grade: 62 },
  { min: 4.0, grade: 61 },
  { min: 0, grade: 60 },
];

export function transmuteGrade(computedAverage: number): number {
  const clamped = Math.min(100, Math.max(0, computedAverage));
  for (const row of TRANSMUTATION) {
    if (clamped >= row.min) return row.grade;
  }
  return 60;
}

export function remarksFromTransmuted(transmuted: number): "Passed" | "Failed" {
  return transmuted >= 75 ? "Passed" : "Failed";
}

export type HonorRollTier = "Highest Honors" | "High Honors" | "With Honors";

// DepEd honor roll classification (DO 8, s. 2015): requires all subject grades
// to be finalized and uses the general average with the lowest subject grade.
// Shared by the academics + overview endpoints so the honor-roll concept is
// identical across principal pages.
export function classifyHonorRoll(
  overallAverage: number,
  lowestSubject: number
): HonorRollTier | null {
  if (overallAverage >= 98 && lowestSubject >= 90) return "Highest Honors";
  if (overallAverage >= 95 && lowestSubject >= 85) return "High Honors";
  if (overallAverage >= 90 && lowestSubject >= 85) return "With Honors";
  return null;
}

// DepEd Order No. 8, s. 2015 assessment weights (WW / PT / QA), which must
// total 100%. Senior High (G11-12) uses one set for every subject;
// Junior High (G7-10) varies by learning area.
export interface DepEdWeights {
  WRITTEN_WORK: number;
  PERFORMANCE_TASK: number;
  QUARTERLY_EXAM: number;
}

export const DEPED_SHS_WEIGHTS: DepEdWeights = {
  WRITTEN_WORK: 25,
  PERFORMANCE_TASK: 45,
  QUARTERLY_EXAM: 30,
};

export const DEPED_JHS_WEIGHTS: { label: string; weights: DepEdWeights }[] = [
  {
    label: "Languages, AP, EsP",
    weights: { WRITTEN_WORK: 30, PERFORMANCE_TASK: 50, QUARTERLY_EXAM: 20 },
  },
  {
    label: "Math & Science",
    weights: { WRITTEN_WORK: 40, PERFORMANCE_TASK: 40, QUARTERLY_EXAM: 20 },
  },
  {
    label: "MAPEH & TLE",
    weights: { WRITTEN_WORK: 20, PERFORMANCE_TASK: 60, QUARTERLY_EXAM: 20 },
  },
];

// Recompute + persist one student's final grade for a subject + term from
// their recorded percentage scores, then return it. Works for registered
// profiles ({ studentId }) and roster enlistments ({ rosterId }) alike.
// Pure grade math — risk recompute / notifications stay with the callers.
export async function recomputeSubjectFinal(
  student: { studentId: string } | { rosterId: string },
  subjectId: string,
  termId: string,
) {
  const gradeFilter =
    "studentId" in student ? { studentId: student.studentId } : { rosterId: student.rosterId };
  const components = await prisma.gradeComponent.findMany({
    where: { subjectId, termId },
    include: { assessments: { include: { studentGrades: { where: gradeFilter } } } },
  });
  const componentAverages = components.map((c) => {
    const grades = c.assessments.flatMap((a) => a.studentGrades);
    const avg = grades.length ? grades.reduce((s, g) => s + g.percentageScore, 0) / grades.length : 0;
    return { weightPercentage: c.weightPercentage, average: avg };
  });
  const { computedAverage, transmutedGrade, remarks } = computeFinalGrade(componentAverages);

  if ("studentId" in student) {
    return prisma.finalGrade.upsert({
      where: { studentId_subjectId_termId: { studentId: student.studentId, subjectId, termId } },
      create: { studentId: student.studentId, subjectId, termId, computedAverage, transmutedGrade, remarks },
      update: { computedAverage, transmutedGrade, remarks },
    });
  }
  return prisma.finalGrade.upsert({
    where: { rosterId_subjectId_termId: { rosterId: student.rosterId, subjectId, termId } },
    create: { studentId: null, rosterId: student.rosterId, subjectId, termId, computedAverage, transmutedGrade, remarks },
    update: { computedAverage, transmutedGrade, remarks },
  });
}

export type StudentKey = { studentId: string } | { rosterId: string };

// Distinct student keys holding a final grade for a subject + term — the
// recompute fan-out set.
export async function finalKeysForSubjectTerm(
  subjectId: string,
  termId: string,
): Promise<StudentKey[]> {
  const rows = await prisma.finalGrade.findMany({
    where: { subjectId, termId },
    select: { studentId: true, rosterId: true },
  });
  return rows.map((r) =>
    r.studentId ? { studentId: r.studentId } : { rosterId: r.rosterId as string },
  );
}

// Weighted sum of component averages → computed grade, then transmute.
// Weights are shares of the final grade and must total 100%.
export function computeFinalGrade(
  componentAverages: { weightPercentage: number; average: number }[]
): { computedAverage: number; transmutedGrade: number; remarks: "Passed" | "Failed" } {
  const totalWeight = componentAverages.reduce((s, c) => s + c.weightPercentage, 0);
  if (totalWeight === 0) {
    return { computedAverage: 0, transmutedGrade: 60, remarks: "Failed" };
  }
  const computedAverage =
    componentAverages.reduce((s, c) => s + (c.average * c.weightPercentage) / 100, 0);
  const transmutedGrade = transmuteGrade(computedAverage);
  return { computedAverage, transmutedGrade, remarks: remarksFromTransmuted(transmutedGrade) };
}
