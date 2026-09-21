import { apiClient } from "@/lib/api/client";

export interface GuidanceKpis {
  referredToMe: number;
  pendingAdm: number;
  pendingCounseling: number;
  openInterventions: number;
  myInterventions: number;
  highRisk: number;
  admHandoffs: number;
}

export interface GuidanceRiskByGradeRow {
  grade: string;
  short: string;
  count: number;
}

export interface GuidanceGradeAttentionRow {
  grade: string;
  short: string;
  sections: number;
  high: number;
  atRisk: number;
  topSection: string;
  topCount: number;
}

export interface GuidanceSectionHeatRow {
  section: string;
  grade: string;
  high: number;
  moderate: number;
  low: number;
  total: number;
}

export interface GuidanceCategoryRow {
  category: string;
  count: number;
}

export interface GuidanceReferralRow {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: string;
  referredBy: string;
  reason: string;
  status: string;
  date: string;
}

export interface GuidanceInterventionRow {
  id: string;
  student: string;
  lrn: string;
  section: string;
  action: string;
  level: string;
  approval: string;
  outcome: string;
}

export interface GuidanceAlertRow {
  // Referral id (not the raw anecdotal id): guidance only sees a filing
  // once an adviser refers it with referredToRole = "guidance_counselor".
  id: string;
  student: string;
  lrn: string;
  section: string;
  category: string;
  referredBy: string;
  reason: string;
  status: string;
  date: string;
}

export interface GuidanceAdmRow {
  id: string;
  student: string;
  lrn: string;
  grade: string;
  stage: string;
  stageLabel: string;
  eligibility: string;
  date: string;
}

export interface GuidanceReferralTypeRow {
  type: string;
  count: number;
}

export interface GuidanceOverviewData {
  counselorName: string;
  termLabel: string;
  kpis: GuidanceKpis;
  riskByLevel: { high: number; moderate: number; low: number };
  factorTotals: { attendance: number; grades: number; behavior: number };
  riskByGrade: GuidanceRiskByGradeRow[];
  gradeAttention: GuidanceGradeAttentionRow[];
  sectionHeat: GuidanceSectionHeatRow[];
  referralsByType: GuidanceReferralTypeRow[];
  referralsQueue: GuidanceReferralRow[];
  interventionsQueue: GuidanceInterventionRow[];
  latestAlerts: GuidanceAlertRow[];
  admQueue: GuidanceAdmRow[];
}

export async function fetchGuidanceOverview(): Promise<GuidanceOverviewData> {
  const { data } = await apiClient.get<GuidanceOverviewData>("/api/guidance/overview");
  return data;
}
