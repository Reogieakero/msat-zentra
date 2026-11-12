import { apiClient } from "@/lib/api/client";
import type {
  BackendBoard,
  BackendHeatmap,
  BackendStudent,
  BackendStudentsResult,
} from "./riskStudents.types";
import { PAGE_SIZE } from "@/components/shared/pagination";

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
  pageSize = PAGE_SIZE,
): Promise<BackendStudentsResult> {
  const params: Record<string, string> = { pageSize: String(pageSize) };
  if (section) params.section = section;
  const { data } = await apiClient.get<BackendStudentsResult>("/api/risk/students", {
    params,
  });
  return data;
}

/**
 * Whole at-risk roster (High + Moderate) in one request. The principal risk
 * desks filter and paginate it in memory so search is instant and never
 * re-fetches while typing.
 */
export async function fetchAllRiskStudents(): Promise<BackendStudent[]> {
  const { data } = await apiClient.get<{ students: BackendStudent[]; total: number }>(
    "/api/risk/students",
    { params: { all: 1 } },
  );
  return data.students;
}
