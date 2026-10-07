// Principal at-risk-students list reads.
import { apiClient } from "@/lib/api/client";
import type { BackendBoard, BackendHeatmap, BackendStudentsResult } from "./riskStudents.types";

export async function fetchHeatmap(
  gradeMode: "raw" | "final" = "final"
): Promise<BackendHeatmap> {
  const { data } = await apiClient.get<BackendHeatmap>("/api/risk/heatmap", {
    params: { gradeMode },
  });
  return data;
}

export async function fetchRiskBoard(): Promise<BackendBoard> {
  const { data } = await apiClient.get<BackendBoard>("/api/risk/board");
  return data;
}

export async function fetchRiskStudents(
  section?: string,
  gradeMode: "raw" | "final" = "final",
  pageSize = 50,
): Promise<BackendStudentsResult> {
  // Default 50 (Teacher-aligned); explicit pageSize=1000 preserved for
  // export/full-scan callers. Server cap stays 1000.
  const params: Record<string, string> = { pageSize: String(pageSize) };
  if (section) params.section = section;
  params.gradeMode = gradeMode;
  const { data } = await apiClient.get<BackendStudentsResult>("/api/risk/students", {
    params,
  });
  return data;
}
