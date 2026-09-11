import { apiClient } from "@/lib/api/client";

export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export const RISK_LEVEL_COLORS: Record<RiskLevelKey, string> = {
  High: "#171717",
  Moderate: "#6b7280",
  Low: "#d1d5db",
};

export const FACTOR_CHIP: Record<RiskFactor, string> = {
  Academic: "#171717",
  Attendance: "#525252",
  Behavioral: "#a3a3a3",
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

export async function fetchHeatmap(): Promise<BackendHeatmap> {
  const { data } = await apiClient.get<BackendHeatmap>("/api/risk/heatmap");
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
  gradeMode: "raw" | "final" = "final"
): Promise<BackendStudentsResult> {
  const params: Record<string, string> = { pageSize: "1000" };
  if (section) params.section = section;
  params.gradeMode = gradeMode;
  const { data } = await apiClient.get<BackendStudentsResult>("/api/risk/students", {
    params,
  });
  return data;
}
