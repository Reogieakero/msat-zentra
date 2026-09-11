import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

/** Invalidate every academic read so scores/locks surface everywhere at once:
 *  advisee records, advisory lists, and teacher overviews. */
export function useRefreshAcademic(): () => void {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["advisee-academic"] });
    queryClient.invalidateQueries({ queryKey: ["advisory-students"] });
    queryClient.invalidateQueries({ queryKey: ["teacher-overview"] });
  }, [queryClient]);
}

export type ComponentType = "WRITTEN_WORK" | "PERFORMANCE_TASK" | "QUARTERLY_EXAM";

export const COMPONENT_ORDER: ComponentType[] = ["WRITTEN_WORK", "PERFORMANCE_TASK", "QUARTERLY_EXAM"];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

export const COMPONENT_NAMES: Record<ComponentType, string> = {
  WRITTEN_WORK: "Written Work",
  PERFORMANCE_TASK: "Performance Task",
  QUARTERLY_EXAM: "Quarterly Exam",
};

export interface ClassAssignment {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
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

export async function saveComponentWeight(
  assignmentId: string,
  input: { componentType: ComponentType; weightPercentage: number }
): Promise<void> {
  await apiClient.post(`/api/teacher/grading/classes/${assignmentId}/components`, input);
}

export type WeightPreset = "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE";

export const WEIGHT_PRESETS: { key: WeightPreset; label: string; hint: string }[] = [
  { key: "SHS", label: "SHS standard", hint: "WW 25 / PT 45 / QE 30" },
  { key: "JHS_LANG", label: "Languages, AP, EsP", hint: "WW 30 / PT 50 / QE 20" },
  { key: "JHS_MATH_SCI", label: "Math & Science", hint: "WW 40 / PT 40 / QE 20" },
  { key: "JHS_MAPEH_TLE", label: "MAPEH & TLE", hint: "WW 20 / PT 60 / QE 20" },
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

/** Percentage score of one assessment, or null when unscored. */
export function psOf(scores: Record<string, number>, studentId: string, maxScore: number): number | null {
  const raw = scores[studentId];
  if (raw == null || maxScore <= 0) return null;
  return (raw / maxScore) * 100;
}

export interface CategoryWork {
  type: ComponentType;
  weight: number;
  parts: { title: string; raw: number; max: number; ps: number }[];
  average: number;
  contribution: number;
}

/** Step-1 working per category, mirroring the backend recompute exactly:
 *  average of recorded percentage scores (0 when nothing recorded yet). */
export function categoryWork(
  components: ClassComponent[],
  studentId: string
): CategoryWork[] {
  return components.map((c) => {
    const parts = c.assessments.flatMap((a) => {
      const ps = psOf(a.scores, studentId, a.maxScore);
      return ps == null ? [] : [{ title: a.title, raw: a.scores[studentId], max: a.maxScore, ps }];
    });
    const average = parts.length > 0 ? parts.reduce((s, p) => s + p.ps, 0) / parts.length : 0;
    return { type: c.type, weight: c.weight, parts, average, contribution: (average * c.weight) / 100 };
  });
}
