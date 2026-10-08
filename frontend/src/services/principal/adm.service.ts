import { apiClient } from "@/lib/api/client";
import { isCancel } from "axios";
import type { AdmDashboard, AdmReferralsPage } from "./adm.types";

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
