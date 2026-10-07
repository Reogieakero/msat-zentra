import { apiClient } from "@/lib/api/client";

export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

// Cross-desk factor hues (same as the teacher risk table): Academic
// amber, Attendance green, Behavioral blue.
export const FACTOR_CHIP: Record<RiskFactor, string> = {
  Academic: "#f59e0b",
  Attendance: "#22c55e",
  Behavioral: "#3b82f6",
};

export const FACTOR_LABELS: Record<RiskFactor, string> = {
  Academic: "Academic",
  Attendance: "Attendance",
  Behavioral: "Behavioral",
};

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface BackendHeatmap {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

export async function fetchHeatmap(
  gradeMode: "raw" | "final" = "final"
): Promise<BackendHeatmap> {
  const { data } = await apiClient.get<BackendHeatmap>("/api/risk/heatmap", {
    params: { gradeMode },
  });
  return data;
}

export interface BackendBoard {
  kpis: {
    totalAtRiskFlags: number;
    highRiskStudents: number;
  };
  levelDistribution: { level: string; count: number }[];
  factorTotals: {
    Academic: number;
    Attendance: number;
    Behavioral: number;
  };
}

export async function fetchRiskBoard(): Promise<BackendBoard> {
  const { data } = await apiClient.get<BackendBoard>("/api/risk/board");
  return data;
}

export interface BackendStudent {
  studentId: string;
  lrn: string;
  name: string;
  section: string;
  riskLevel: "High" | "Moderate" | "Low";
  riskCount: number;
  factors: {
    Academic: boolean;
    Attendance: boolean;
    Behavioral: boolean;
  };
}

export interface BackendStudentsResult {
  students: BackendStudent[];
  total: number;
  page: number;
  pageSize: number;
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
