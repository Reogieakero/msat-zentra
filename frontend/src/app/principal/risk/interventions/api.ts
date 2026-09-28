import { apiClient } from "@/lib/api/client";
import type { InterventionStudentsResult, StudentFilters } from "./types";

export async function fetchInterventionStudents(
  filters: StudentFilters,
  page = 1,
  pageSize = 20
): Promise<InterventionStudentsResult> {
  const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
  if (filters.riskLevel && filters.riskLevel !== "all") params.riskLevel = filters.riskLevel;
  if (filters.hasIntervention !== undefined)
    params.hasIntervention = String(filters.hasIntervention);
  if (filters.factor && filters.factor !== "all") params.factor = filters.factor;
  if (filters.gradeMode) params.gradeMode = filters.gradeMode;

  const { data } = await apiClient.get<InterventionStudentsResult>(
    "/api/risk/interventions",
    { params }
  );
  return data;
}

export interface InterventionStats {
  totalAtRisk: number;
  withIntervention: number;
  pendingApproval: number;
  highRisk: number;
  resolved: number;
  ongoing: number;
}

export async function fetchInterventionStats(): Promise<InterventionStats> {
  const { data } = await apiClient.get<InterventionStats>("/api/risk/interventions/stats");
  return data;
}

// Backend errors arrive as { error: { code, message } } — surface the
// server's message instead of a generic failure notice.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}

// Principal-only: nudge every active guidance counselor about an at-risk
// student with no intervention action yet.
export async function alertGuidance(studentId: string, note?: string): Promise<void> {
  await apiClient.post(
    `/api/risk/interventions/${encodeURIComponent(studentId)}/alert`,
    note?.trim() ? { note: note.trim() } : {}
  );
}
