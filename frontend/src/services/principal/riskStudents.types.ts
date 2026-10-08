export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

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
