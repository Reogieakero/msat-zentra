import { apiClient } from "@/lib/api/client";

export interface OverviewKpis {
  enrollment: number;
  activeSections: number;
  teachers: number;
  anecdotals: number;
}

export interface OverviewAtRisk {
  attendance: number;
  grades: number;
  behavior: number;
  students: number;
}

export interface OverviewRiskLevels {
  high: number;
  moderate: number;
  low: number;
}

export interface OverviewRiskGradeRow {
  grade: string;
  count: number;
}

export interface OverviewSectionRow {
  grade: string;
  section: string;
  count: number;
}

export interface OverviewData {
  kpis: OverviewKpis;
  atRisk: OverviewAtRisk;
  riskByLevel: OverviewRiskLevels;
  riskByGrade: OverviewRiskGradeRow[];
  sections: OverviewSectionRow[];
  admPending: number;
  accountApprovals: number;
  attendanceWatch: number;
  honorRoll: number;
}

export async function fetchOverview(): Promise<OverviewData> {
  const { data } = await apiClient.get<OverviewData>("/api/overview");
  return data;
}