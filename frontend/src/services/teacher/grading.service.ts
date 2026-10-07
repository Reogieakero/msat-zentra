"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import type {
  ClassAssessment,
  ClassDetail,
  ComponentType,
  ScoreResult,
  WeightPreset,
} from "./grading.types";

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
