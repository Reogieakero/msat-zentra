"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

/** Invalidate every academic read so scores/locks surface everywhere at once:
 *  advisee records, advisory lists, and teacher overviews. */
export function useRefreshAcademic(): () => void {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["advisee-academic"] });
    queryClient.invalidateQueries({ queryKey: ["advisory-students"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-overview"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-overview-secondary"] });
  }, [queryClient]);
}

export type ComponentType = "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";

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

export interface ClassAssignment {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectCategory: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
  termId: string;
  termNumber: number;
  schoolYear: string;
}

export interface ClassFinal {
  id: string;
  studentId: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string | null;
}

export interface ClassStudent {
  id: string;
  name: string;
  lrn: string;
  hasAccount: boolean;
  final: ClassFinal | null;
}

export interface ClassAssessment {
  id: string;
  title: string;
  maxScore: number;
  dateGiven: string;
  createdAt: string;
  scores: Record<string, number>;
}

export interface ClassComponent {
  id: string;
  type: ComponentType;
  label: string;
  weight: number;
  assessments: ClassAssessment[];
}

export interface ClassDetail {
  assignment: ClassAssignment;
  students: ClassStudent[];
  components: ClassComponent[];
}

export async function fetchClassDetail(assignmentId: string): Promise<ClassDetail> {
  const { data } = await apiClient.get<ClassDetail>(`/api/teacher/grading/classes/${assignmentId}`);
  return data;
}

/** Teacher-scoped class key — one teacher's class detail must never leak to
 *  another teacher's session. Prefix invalidations on
 *  ["teacher-grading-class"] still match. */
export function classDetailKey(
  teacherId: string | null | undefined,
  assignmentId: string,
) {
  return ["teacher-grading-class", teacherId ?? "anon", assignmentId] as const;
}

/** Class workspace detail. Keeps the previous class on screen while the next
 *  one loads so switching classes never flashes a full-page skeleton. */
export function useClassDetail(assignmentId: string) {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  return useQuery({
    queryKey: classDetailKey(teacherId, assignmentId),
    queryFn: () => fetchClassDetail(assignmentId),
    enabled: !!teacherId && !!assignmentId,
    // Fail fast like every other query — no backoff retries before the
    // error state. Keeps previous data visible via placeholderData below.
    retry: false,
    // Keep the previous class on screen while the next one loads so
    // switching classes never flashes a full-page skeleton.
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
}

export async function saveComponentWeight(
  assignmentId: string,
  input: { componentType: ComponentType; weightPercentage: number }
): Promise<void> {
  await apiClient.post(`/api/teacher/grading/classes/${assignmentId}/components`, input);
}

export type WeightPreset = "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE";

export const WEIGHT_PRESETS: { key: WeightPreset; label: string; hint: string }[] = [
  { key: "SHS", label: "SHS standard", hint: "WW 25 / PT 45 / E 30" },
  { key: "JHS_LANG", label: "Languages, AP, EsP", hint: "WW 30 / PT 50 / E 20" },
  { key: "JHS_MATH_SCI", label: "Math & Science", hint: "WW 40 / PT 40 / E 20" },
  { key: "JHS_MAPEH_TLE", label: "MAPEH & TLE", hint: "WW 20 / PT 60 / E 20" },
];

export async function applyWeightPreset(assignmentId: string, preset: WeightPreset): Promise<void> {
  await apiClient.post(`/api/teacher/grading/classes/${assignmentId}/components/preset`, { preset });
}

export async function createAssessment(
  assignmentId: string,
  input: { componentType: ComponentType; title: string; maxScore: number; dateGiven?: string }
): Promise<ClassAssessment> {
  const { data } = await apiClient.post<ClassAssessment>(
    `/api/teacher/grading/classes/${assignmentId}/assessments`,
    input
  );
  return data;
}

export async function updateAssessment(
  id: string,
  input: { title?: string; maxScore?: number; dateGiven?: string }
): Promise<void> {
  await apiClient.patch(`/api/teacher/grading/assessments/${id}`, input);
}

export async function deleteAssessment(id: string): Promise<void> {
  await apiClient.delete(`/api/teacher/grading/assessments/${id}`);
}

export interface ScoreResult {
  computedAverage: number;
  transmutedGrade: number;
  remarks: string;
}

export async function submitScore(
  assessmentId: string,
  input: { studentId: string; rawScore: number }
): Promise<ScoreResult> {
  const { data } = await apiClient.post<ScoreResult>(`/api/grades/assessments/${assessmentId}/score`, input);
  return data;
}

export async function lockFinalGrade(id: string): Promise<void> {
  await apiClient.post(`/api/grades/final-grades/${id}/lock`, {});
}

/** "G11" -> "11", passthrough otherwise. */
export function gradeLabel(gradeLevel: string): string {
  const n = gradeLevel.replace(/^G/i, "");
  return /^\d+$/.test(n) ? n : gradeLevel;
}

/** Senior High (G11/G12) uses the single DepEd weight set for every subject. */
export function isSHS(gradeLevel: string): boolean {
  const n = gradeLevel.replace(/^G/i, "");
  return n === "11" || n === "12";
}

// Official DepEd Order No. 8, s. 2015 transmutation bands (mirrors
// backend/src/services/grading.ts, the source of truth for stored grades).
// Each band is the inclusive lower bound of the initial-grade range.
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

export interface TransmutationBand {
  grade: number;
  low: number;
  high: number;
}

/** Find the DepEd table band an initial grade falls in (for display). */
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

// ---------------------------------------------------------------------------
// Assessment-driven grade computation — client twin of backend
// services/grading.ts computeSubjectGrade (the source of truth for stored
// grades). Same rules: only categories with assessments contribute (weights
// normalized), earned/possible over recorded scores, N/A never zero, no
// evidence → null instead of a fake 0% / Failed.
// ---------------------------------------------------------------------------

export type CategoryEvidence = {
  componentType: string;
  weightPercentage: number;
  earned: number;
  possible: number;
  assessmentCount: number;
  encodedCount: number;
};

export type CategoryResult = {
  componentType: string;
  assessmentCount: number;
  encodedCount: number;
  coverage: number | null;
  percentage: number | null;
  configuredWeight: number;
  normalizedWeight: number;
  effectiveWeight: number;
};

export type SubjectGradeComputation = {
  availableCategories: string[];
  categories: CategoryResult[];
  existingAssessments: number;
  encodedAssessments: number;
  coverage: number | null;
  rawGrade: number | null;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: "Passed" | "Failed" | null;
};

const CANONICAL_ORDER = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"];

/** Per-category evidence for one student from workspace components. */
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
