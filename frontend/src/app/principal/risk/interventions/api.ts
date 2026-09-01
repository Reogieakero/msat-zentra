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
