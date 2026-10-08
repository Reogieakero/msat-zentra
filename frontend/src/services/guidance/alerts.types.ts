export type GuidanceAlertLevel = "High" | "Moderate";
export type GuidanceAlertFactor = "academic" | "attendance" | "behavioral";

export interface GuidanceAlertItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  level: GuidanceAlertLevel;
  flagCount: number;
  factors: { academic: boolean; attendance: boolean; behavioral: boolean };
  triggers: string[];
  anecdotalCount: number;
  referralStatus: string | null;
  interventionOutcome: string | null;

  track: "adm" | "general";
  admStageLabel: string | null;
}

export interface GuidanceAlertsSummary {
  high: number;
  moderate: number;
  total: number;
  academic: number;
  attendance: number;
  behavioral: number;
  referred: number;
  unreferred: number;
}

export interface GuidanceAlertsData {
  termLabel: string;
  summary: GuidanceAlertsSummary;
  alerts: GuidanceAlertItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceAlertsParams {
  q?: string;
  level?: "" | GuidanceAlertLevel;
  factor?: "" | GuidanceAlertFactor;
  page?: number;
  pageSize?: number;
}
