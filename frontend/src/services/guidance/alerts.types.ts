import type { GuidanceReferralItem, GuidanceRiskLevel } from "./guidance.types";
import type { AtRiskStudentItem } from "./interventions.types";

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

/* ── Merged alerts desk (referrals + interventions), server-paged ───────── */

export type AlertCaseType = "" | "ADM" | "Counseling" | "Intervention";
export type AlertCaseRisk = "" | GuidanceRiskLevel;

export interface GuidanceAlertUrgentItem {
  student: string;
  lrn: string;
  kind: "referral" | "intervention";
  id: string;
  track: "adm" | "counseling" | "intervention";
}

export interface GuidanceAlertDetectedItem {
  studentKey: string;
  student: string;
  lrn: string;
  riskLevel: string;
  detectedAt: string | null;
}

export interface GuidanceAlertCasesSummary {
  total: number;
  high: number;
  moderate: number;
  adm: number;
  counseling: number;
  intervention: number;
  detected: number;
  latestDetected: GuidanceAlertDetectedItem[];
  urgentCount: number;
  urgent: GuidanceAlertUrgentItem[];
}

export interface GuidanceAlertCasesParams {
  type?: AlertCaseType;
  risk?: AlertCaseRisk;
  q?: string;
  page?: number;
  pageSize?: number;
}

export type GuidanceAlertCase =
  | { kind: "referral"; referral: GuidanceReferralItem }
  | { kind: "intervention"; item: AtRiskStudentItem };

export interface GuidanceAlertCasesData {
  cases: GuidanceAlertCase[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
  summary: GuidanceAlertCasesSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
