import type {
  CategoryEvidence,
  CategoryResult,
  ClassComponent,
  ComponentType,
  SubjectGradeComputation,
  TransmutationBand,
} from "./grading.types";

export const COMPONENT_ORDER: ComponentType[] = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

export const COMPONENT_NAMES: Record<ComponentType, string> = {
  WRITTEN_WORK: "Written Work",
  PERFORMANCE_TASK: "Performance Task",
  EXAM: "Exam",
};

export function gradeLabel(gradeLevel: string): string {
  const n = gradeLevel.replace(/^G/i, "");
  return /^\d+$/.test(n) ? n : gradeLevel;
}

export function isSHS(gradeLevel: string): boolean {
  const n = gradeLevel.replace(/^G/i, "");
  return n === "11" || n === "12";
}

export const TRANSMUTATION_BANDS: { min: number; grade: number }[] = [
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

export function bandForGrade(computed: number): TransmutationBand {
  const clamped = Math.min(100, Math.max(0, computed));
  for (let i = 0; i < TRANSMUTATION_BANDS.length; i += 1) {
    const band = TRANSMUTATION_BANDS[i];
    if (clamped >= band.min) {
      const high = i === 0 ? 100 : TRANSMUTATION_BANDS[i - 1].min - 0.01;
      return { grade: band.grade, low: band.min, high };
    }
  }
  return { grade: 60, low: 0, high: 3.99 };
}

const CANONICAL_ORDER = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"];

export function subjectEvidence(
  components: ClassComponent[],
  studentId: string,
): CategoryEvidence[] {
  return components.map((c) => {
    let earned = 0;
    let possible = 0;
    let encodedCount = 0;
    for (const a of c.assessments) {
      const raw = a.scores[studentId];
      if (raw == null) continue;
      encodedCount += 1;
      earned += raw;
      possible += a.maxScore;
    }
    return {
      componentType: c.type,
      weightPercentage: c.weight,
      earned,
      possible,
      assessmentCount: c.assessments.length,
      encodedCount,
    };
  });
}

export function computeSubjectGrade(evidence: CategoryEvidence[]): SubjectGradeComputation {
  const byType = new Map(evidence.map((e) => [e.componentType, e]));
  const rows = CANONICAL_ORDER.map((t) => ({
    componentType: t,
    weightPercentage: 0,
    earned: 0,
    possible: 0,
    assessmentCount: 0,
    encodedCount: 0,
    ...(byType.get(t) ?? {}),
  }));
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
  if (active.length === 0) return base;

  const availWeight = active.reduce((s, r) => s + r.weightPercentage, 0);
  for (const r of active) {
    byResult.get(r.componentType)!.normalizedWeight =
      availWeight > 0 ? (r.weightPercentage * 100) / availWeight : 100 / active.length;
  }
  const evidenced = active.filter(
    (r) => byResult.get(r.componentType)!.percentage !== null,
  );
  if (evidenced.length === 0) return base;
  let scale = evidenced.reduce(
    (s, r) => s + byResult.get(r.componentType)!.normalizedWeight,
    0,
  );
  if (scale <= 0) {
    for (const r of evidenced) {
      byResult.get(r.componentType)!.normalizedWeight = 100 / evidenced.length;
    }
    scale = 100;
  }
  for (const r of evidenced) {
    const c = byResult.get(r.componentType)!;
    c.effectiveWeight = (c.normalizedWeight * 100) / scale;
  }
  const rawGrade =
    evidenced.reduce((s, r) => {
      const c = byResult.get(r.componentType)!;
      return s + c.percentage! * c.normalizedWeight;
    }, 0) / scale;
  const transmutedGrade = bandForGrade(rawGrade).grade;
  return {
    ...base,
    rawGrade,
    computedAverage: rawGrade,
    transmutedGrade,
    remarks: transmutedGrade >= 75 ? "Passed" : "Failed",
  };
}
