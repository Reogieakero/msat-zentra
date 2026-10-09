import { apiClient } from "@/lib/api/client";
import type { BackendBoard, BackendHeatmap, BackendStudentsResult } from "./riskStudents.types";

// Real-time unified: no gradeMode.
export async function fetchHeatmap(): Promise<BackendHeatmap> {
  const { data } = await apiClient.get<BackendHeatmap>("/api/risk/heatmap");
  return data;
}

export async function fetchRiskBoard(): Promise<BackendBoard> {
  const { data } = await apiClient.get<BackendBoard>("/api/risk/board");
  return data;
}

export async function fetchRiskStudents(
  section?: string,
  pageSize = 50,
): Promise<BackendStudentsResult> {
  const params: Record<string, string> = { pageSize: String(pageSize) };
  if (section) params.section = section;
  const { data } = await apiClient.get<BackendStudentsResult>("/api/risk/students", {
    params,
  });
  return data;
}
