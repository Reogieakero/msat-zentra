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
  stage: "referred" | "eligibility" | "principal_approval";
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

export async function fetchAdmDashboard(signal?: AbortSignal): Promise<AdmDashboard | null> {
  try {
    const res = await apiClient.get<AdmDashboard>("/api/adm/dashboard", { signal });
    return res.data;
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}
