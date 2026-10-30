"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import type {
  ClassAssessment,
  ClassDetail,
  ComponentType,
  ScoreResult,
  WeightPreset,
} from "./grading.types";

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

export function classDetailKey(
  teacherId: string | null | undefined,
  assignmentId: string,
  termKey?: string,
) {
  // Term-scoped: grading classes differ per term.
  return ["teacher-grading-class", teacherId ?? "anon", assignmentId, termKey ?? ""] as const;
}

export function useClassDetail(assignmentId: string) {
  const session = useSession();
  const teacherId = session?.sub ?? null;
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  return useQuery({
    queryKey: classDetailKey(teacherId, assignmentId, termKey),
    queryFn: () => fetchClassDetail(assignmentId),
    enabled: !!teacherId && !!assignmentId,

    retry: false,

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

export async function saveComponentWeights(
  assignmentId: string,
  weights: { componentType: ComponentType; weightPercentage: number }[]
): Promise<void> {
  await apiClient.post(`/api/teacher/grading/classes/${assignmentId}/components/batch`, { weights });
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

export interface BulkScoreItem {
  studentId: string;
  rawScore: number;
}

export interface BulkScoreResult {
  studentId: string;
  ok: boolean;
  error?: string;
  rawScore?: number;
  percentageScore?: number;
  unchanged?: boolean;
}

export interface BulkScoreResponse {
  saved: number;
  total: number;
  results: BulkScoreResult[];
}

export async function submitScores(
  assessmentId: string,
  scores: BulkScoreItem[]
): Promise<BulkScoreResponse> {
  const { data } = await apiClient.post<BulkScoreResponse>(
    `/api/grades/assessments/${assessmentId}/scores`,
    { scores }
  );
  return data;
}

export async function lockFinalGrade(id: string, code?: string): Promise<void> {
  await apiClient.post(`/api/grades/final-grades/${id}/lock`, code ? { code } : {});
}

export interface LockBatchResponse {
  locked: number;
  skipped: number;
}

export async function lockBatchGrades(assignmentId: string, code: string): Promise<LockBatchResponse> {
  const { data } = await apiClient.post<LockBatchResponse>(`/api/grades/final-grades/lock-batch`, {
    assignmentId,
    code,
  });
  return data;
}

export function lockErrorMessage(err: unknown): string {
  const data = (err as { response?: { status?: number; data?: unknown } })?.response?.data as
    | { error?: { code?: string; message?: string }; code?: string; message?: string }
    | undefined;
  const code = data?.error?.code ?? data?.code;
  const serverMessage = data?.error?.message ?? data?.message;
  if (code === "CODE_MISMATCH") return "That code does not match the code you linked in My Classes. Copy the exact code from My Classes and try again.";
  if (code === "NOT_LINKED") return "No link code found — link your code in My Classes first.";
  if (code === "CODE_REQUIRED") return "Enter your subject teacher code.";
  if (code === "FORBIDDEN") return "Your login role cannot lock grades (needs subject teacher or adviser).";
  if (code === "ALREADY_LOCKED") return "Already locked.";
  if (code === "NOTHING_TO_LOCK") return "Nothing to lock — all grades are already locked or have no average yet.";
  if (code === "NO_ACTIVE_TERM") return "No active term selected — pick a school year and term first.";
  if (code === "CLASS_NOT_FOUND") return "Class not found in the active term — switch your term picker to the class term and try again.";
  return serverMessage ?? "Could not lock grades. Try again.";
}
