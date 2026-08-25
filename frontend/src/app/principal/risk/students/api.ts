import { apiClient } from "@/lib/api/client";

export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export const RISK_LEVEL_COLORS: Record<RiskLevelKey, string> = {
  High: "#b91c1c",
  Moderate: "#d97706",
  Low: "#15803d",
};

export const FACTOR_CHIP: Record<RiskFactor, string> = {
  Academic: "#b91c1c",
  Attendance: "#2563eb",
  Behavioral: "#7c3aed",
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
  section?: string
): Promise<BackendStudentsResult> {
  const { data } = await apiClient.get<BackendStudentsResult>("/api/risk/students", {
    params: section ? { section, pageSize: 1000 } : { pageSize: 1000 },
  });
  return data;
}
