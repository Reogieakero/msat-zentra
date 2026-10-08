export type RiskLevelKey = "High" | "Moderate" | "Low";

export const RISK_LEVEL_COLORS: Record<RiskLevelKey, string> = {
  High: "#171717",
  Moderate: "#6b7280",
  Low: "#d1d5db",
};

export interface RiskBoardData {
  kpis: {
    totalAtRiskFlags: number;
    highRiskStudents: number;
  };
  levelDistribution: { level: RiskLevelKey; count: number }[];
  factorTotals: { Academic: number; Attendance: number; Behavioral: number };
  interventionOutcome: {
    ongoing: number;
    resolved: number;
    unresolved: number;
  };
  trend: { term: string; high: number; moderate: number; low: number }[];
}

export interface RiskTrendData {
  schoolYearId: string | null;
  termId: string | null;
  trend: { date: string; term: string; high: number; moderate: number; low: number }[];
}

export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface HeatmapData {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevelKey;
  factor: RiskFactor;
}

export interface LowRiskStudent {
  lrn: string;
  name: string;
}

export interface LowRiskResult {
  students: LowRiskStudent[];
  total: number;
  page: number;
  pageSize: number;
}
