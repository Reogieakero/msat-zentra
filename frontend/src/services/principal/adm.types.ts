export interface AdmDashboardKpis {
  pendingSignature: number;
  signed: number;
  active: number;
}

export interface AdmStageCount {
  stage: string;
  short: string;
  count: number;
}

export interface AdmSectionCount {
  section: string;
  count: number;
}

export interface AdmFormRef {
  id: string;
  formType: string;
  title: string;
  status: string;
  uploadedAt: string | null;
}

export interface AdmLatestReferred {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  stage: "consultation" | "meeting_parents" | "home_visitation" | "certification" | "principal_approval";
  eligibilityStatus: string;
  preparedBy: string;
  datePrepared: string | null;
  approvedBy: string | null;
  forms: AdmFormRef[];
}

export interface AdmDashboardTrendWeek {
  week: string;
  label: string;
  count: number;
}

export interface AdmDashboard {
  kpis: AdmDashboardKpis;
  stageBreakdown: AdmStageCount[];
  sectionBreakdown: AdmSectionCount[];
  latestReferred: AdmLatestReferred[];
  trend: AdmDashboardTrendWeek[];
  totalReferred: number;
  needsRevision: number;
  deviceSummary: { issued: number; returned: number };
}

export interface AdmReferralForm {
  id: string;
  formType: string;
  title: string;
  status: string;
  fileUrl: string | null;
  notes: string | null;
  uploadedAt: string | null;
}

export interface AdmReferralRow {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  section: string;
  anecdotalRecordId: string | null;
  /** Anecdotal record category — colours the anecdotal folder in the forms overlay. */
  anecdotalCategory: string | null;
  stage: "consultation" | "meeting_parents" | "home_visitation" | "certification" | "principal_approval";
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  preparedBy: string;
  datePrepared: string;
  approvedBy: string | null;
  approvalDate: string | null;
  /** Set when the Principal returned the case; cleared once re-certified. */
  returnedAt: string | null;
  returnReason: string | null;
  forms: AdmReferralForm[];
}

export interface AdmReferralsPage {
  rows: AdmReferralRow[];
  total: number;
  totalReferred: number;
  stageCounts: Record<string, number>;
  page: number;
  totalPages: number;
  limit: number;
}
