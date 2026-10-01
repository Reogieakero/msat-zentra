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

// DepEd Order No. 8, s. 2015 assessment weights (WW / PT / E), which must
// total 100%. Senior High (G11-12) uses one set for every subject;
// Junior High (G7-10) varies by learning area.
export interface DepEdWeights {
  WRITTEN_WORK: number;
  PERFORMANCE_TASK: number;
  EXAM: number;
}

export const DEPED_SHS_WEIGHTS: DepEdWeights = {
  WRITTEN_WORK: 25,
  PERFORMANCE_TASK: 45,
  EXAM: 30,
};

export const DEPED_JHS_WEIGHTS: { label: string; weights: DepEdWeights }[] = [
  {
    label: "Languages, AP, EsP",
    weights: { WRITTEN_WORK: 30, PERFORMANCE_TASK: 50, EXAM: 20 },
  },
  {
    label: "Math & Science",
    weights: { WRITTEN_WORK: 40, PERFORMANCE_TASK: 40, EXAM: 20 },
  },
  {
    label: "MAPEH & TLE",
    weights: { WRITTEN_WORK: 20, PERFORMANCE_TASK: 60, EXAM: 20 },
  },
];

// ---------------------------------------------------------------------------
// Assessment-driven grade computation — the single source of truth for the
// pipeline: Assessment → Category → Weighted → Final (+ Risk inputs).
//
// Rules:
// - Only categories that actually contain assessments contribute. A
//   category with no assessments is N/A — never an automatic zero.
// - Configured weights of available categories are normalized to 100.
// - Within a category, the percentage is total-earned / total-possible over
//   RECORDED assessments only (DepEd Order No. 8 method). An assessment that
//   exists but has no encoded score for the student is excluded — never an
//   automatic zero (no such grading policy exists in this codebase).
// - A student is graded only on categories where they have encoded scores;
//   those shares are rescaled to 100. No evidence at all → null (no fake
//   0% / Failed); callers delete any stale final row.
// ---------------------------------------------------------------------------

export const CATEGORY_ORDER = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"] as const;

export type CategoryKey = (typeof CATEGORY_ORDER)[number];

export interface CategoryEvidence {
  componentType: string;
  weightPercentage: number;
  /** Σ rawScore over assessments WITH this student's score. */
  earned: number;
  /** Σ maxScore over assessments WITH this student's score. */
  possible: number;
  /** Assessments existing in the category (subject + term). */
  assessmentCount: number;
  /** Of those, with this student's score encoded. */
  encodedCount: number;
}

export interface CategoryResult {
  componentType: string;
  assessmentCount: number;
  encodedCount: number;
  /** Encoded / existing (null when nothing exists). Separate from performance. */
  coverage: number | null;
  /** Earned / possible × 100 (null when the student has nothing encoded). */
  percentage: number | null;
  configuredWeight: number;
  /** Share within available (existing) categories. */
  normalizedWeight: number;
  /** Share within categories where the student has evidence. */
  effectiveWeight: number;
}

export interface SubjectGradeComputation {
  availableCategories: string[];
  categories: CategoryResult[];
  existingAssessments: number;
  encodedAssessments: number;
  coverage: number | null;
  rawGrade: number | null;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: "Passed" | "Failed" | null;
}

export function computeSubjectGrade(evidence: CategoryEvidence[]): SubjectGradeComputation {
  const byType = new Map(evidence.map((e) => [e.componentType, e]));
  // Every canonical category is reported (transparency), even ones with no
  // component row — they read as N/A with zero weights.
  const rows = CATEGORY_ORDER.map(
    (t): Required<CategoryEvidence> & { componentType: string } =>
      byType.get(t) ?? {
        componentType: t,
        weightPercentage: 0,
        earned: 0,
        possible: 0,
        assessmentCount: 0,
        encodedCount: 0,
      },
  );
  const existingAssessments = rows.reduce((s, r) => s + r.assessmentCount, 0);
  const encodedAssessments = rows.reduce((s, r) => s + r.encodedCount, 0);
  const active = rows.filter((r) => r.assessmentCount > 0);

  const categories: CategoryResult[] = rows.map((r) => ({
    componentType: r.componentType,
    assessmentCount: r.assessmentCount,
    encodedCount: r.encodedCount,
    coverage: r.assessmentCount > 0 ? r.encodedCount / r.assessmentCount : null,
    percentage:
      r.encodedCount > 0 && r.possible > 0 ? (r.earned / r.possible) * 100 : null,
    configuredWeight: r.weightPercentage,
    normalizedWeight: 0,
    effectiveWeight: 0,
  }));
  const byResult = new Map(categories.map((c) => [c.componentType, c]));

  const base: SubjectGradeComputation = {
    availableCategories: active.map((r) => r.componentType),
    categories,
    existingAssessments,
    encodedAssessments,
    coverage: existingAssessments > 0 ? encodedAssessments / existingAssessments : null,
    rawGrade: null,
    computedAverage: null,
    transmutedGrade: null,
    remarks: null,
  };
  // Case 7: no assessments exist anywhere — no grade, never 0% / Failed.
  if (active.length === 0) return base;

  // Normalize configured weights across available categories. Unconfigured
  // (all-zero) weights fall back to an equal split — never a fake failure.
  const availWeight = active.reduce((s, r) => s + r.weightPercentage, 0);
  for (const r of active) {
    byResult.get(r.componentType)!.normalizedWeight =
      availWeight > 0 ? (r.weightPercentage * 100) / availWeight : 100 / active.length;
  }
  // Grade the student only on categories where they have encoded scores.
  const evidenced = active.filter((r) => {
    const c = byResult.get(r.componentType)!;
    return c.percentage !== null;
  });
  if (evidenced.length === 0) return base;
  let scale = evidenced.reduce(
    (s, r) => s + byResult.get(r.componentType)!.normalizedWeight,
    0,
  );
  if (scale <= 0) {
    // Degenerate (evidenced categories carry no weight): equal split.
    for (const r of evidenced) byResult.get(r.componentType)!.normalizedWeight = 100 / evidenced.length;
    scale = 100;
  }
  for (const r of evidenced) {
    const c = byResult.get(r.componentType)!;
    c.effectiveWeight = (c.normalizedWeight * 100) / scale;
  }
  const rawGrade =
    evidenced.reduce(
      (s, r) => s + byResult.get(r.componentType)!.percentage! * byResult.get(r.componentType)!.normalizedWeight,
      0,
    ) / scale;
  const transmutedGrade = transmuteGrade(rawGrade);
  return {
    ...base,
    rawGrade,
    computedAverage: rawGrade,
    transmutedGrade,
    remarks: remarksFromTransmuted(transmutedGrade),
  };
}

// Recompute + persist one student's final grade for a subject + term from
// their recorded percentage scores, then return it. Works for registered
// profiles ({ studentId }) and roster enlistments ({ rosterId }) alike.
// Pure grade math — risk recompute / notifications stay with the callers.
//
// Assessment-driven: only categories that actually contain assessments
// contribute (weights normalized across them); a category with no
// assessments is N/A, never zero. A student with no encoded scores in any
// existing category gets no final row at all (existing row deleted) —
// never a fake 0% / Failed.
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
  const evidence: CategoryEvidence[] = components.map((c) => {
    const encoded = c.assessments.filter((a) => a.studentGrades.length > 0);
    return {
      componentType: c.componentType,
      weightPercentage: c.weightPercentage,
      earned: encoded.reduce(
        (s, a) => s + a.studentGrades.reduce((x, g) => x + g.rawScore, 0),
        0,
      ),
      possible: encoded.reduce((s, a) => s + a.maxScore, 0),
      assessmentCount: c.assessments.length,
      encodedCount: encoded.length,
    };
  });
  const result = computeSubjectGrade(evidence);
  if (result.rawGrade === null || result.computedAverage === null) {
    // Case 7: no assessments (or nothing encoded) — remove any stale final
    // row instead of manufacturing a fake 0% / Failed.
    if ("studentId" in student) {
      await prisma.finalGrade.deleteMany({
        where: { studentId: student.studentId, subjectId, termId },
      });
    } else {
      await prisma.finalGrade.deleteMany({
        where: { rosterId: student.rosterId, subjectId, termId },
      });
    }
    return null;
  }
  const { computedAverage, transmutedGrade, remarks } = result;
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
