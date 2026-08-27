import { apiClient } from "@/lib/api/client";
import type {
  CreateInterventionBody,
  InterventionStudentsResult,
  PatchInterventionBody,
  RiskSnapshotStudent,
  StaffOption,
  StudentFilters,
} from "./types";

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

export async function fetchStaffOptions(): Promise<StaffOption[]> {
  const { data } = await apiClient.get<StaffOption[]>("/api/risk/staff");
  return data;
}

export async function createIntervention(
  body: CreateInterventionBody
): Promise<RiskSnapshotStudent["intervention"]> {
  const { data } = await apiClient.post<RiskSnapshotStudent["intervention"]>(
    "/api/risk/interventions",
    body
  );
  return data;
}

export async function updateIntervention(
  id: string,
  body: PatchInterventionBody
): Promise<RiskSnapshotStudent["intervention"]> {
  const { data } = await apiClient.patch<RiskSnapshotStudent["intervention"]>(
    `/api/risk/interventions/${id}`,
    body
  );
  return data;
}
