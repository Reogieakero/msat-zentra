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
  stage: "meeting_parents" | "home_visitation" | "certification" | "principal_approval";
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

export interface AdmReferralRow {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  stage: "meeting_parents" | "home_visitation" | "certification" | "principal_approval";
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  preparedBy: string;
  datePrepared: string;
  approvedBy: string | null;
  approvalDate: string | null;
  forms: { id: string; formType: string; title: string; status: string }[];
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

export interface AdmApprovalRow {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  section: string;
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  preparedBy: string;
  approvedBy: string | null;
  approvalDate: string | null;
  forms: { id: string; formType: string; title: string; status: string }[];
}

export interface AdmApprovalsPage {
  rows: AdmApprovalRow[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export async function fetchAdmApprovals(
  page = 1,
  limit = 20,
  signal?: AbortSignal,
  q?: string
): Promise<AdmApprovalsPage> {
  const res = await apiClient.get<AdmApprovalsPage>("/api/adm/approvals", {
    signal,
    params: {
      page,
      limit,
      ...(q ? { q } : {}),
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
