import { apiClient } from "@/lib/api/client";
import { isCancel } from "axios";

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
  approvedBy: string | null;
  forms: AdmFormRef[];
}

export interface AdmDashboard {
  kpis: AdmDashboardKpis;
  stageBreakdown: AdmStageCount[];
  latestReferred: AdmLatestReferred[];
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
  stage: "consultation" | "meeting_parents" | "home_visitation" | "certification" | "principal_approval";
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  preparedBy: string;
  datePrepared: string;
  approvedBy: string | null;
  approvalDate: string | null;
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

export async function fetchAdmReferrals(
  page: number,
  limit = 20,
  signal?: AbortSignal,
  q?: string,
  stage?: string
): Promise<AdmReferralsPage> {
  const res = await apiClient.get<AdmReferralsPage>("/api/adm/referrals/all", {
    signal,
    params: {
      page,
      limit,
      ...(q ? { q } : {}),
      ...(stage ? { stage } : {}),
    },
  });
  return res.data;
}

export async function fetchAdmDashboard(signal?: AbortSignal): Promise<AdmDashboard | null> {
  try {
    const res = await apiClient.get<AdmDashboard>("/api/adm/dashboard", { signal });
    return res.data;
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}
