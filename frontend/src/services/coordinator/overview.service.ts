// Page-level fetchers for the ADM Coordinator desk: dashboard, referral
// queue, approvals, device ledger.
import { apiClient } from "@/lib/api/client";
import type {
  AdmApprovalsPage,
  AdmDashboard,
  AdmDevicesPage,
  AdmEligibility,
  AdmReferralsPage,
} from "./coordinator.types";

export async function fetchCoordinatorDashboard(signal?: AbortSignal): Promise<AdmDashboard> {
  const res = await apiClient.get<AdmDashboard>("/api/adm/dashboard", { signal });
  return res.data;
}

export async function fetchCoordinatorReferrals(
  page: number,
  opts?: {
    q?: string;
    stage?: string;
    eligibility?: "all" | AdmEligibility;
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<AdmReferralsPage> {
  const res = await apiClient.get<AdmReferralsPage>("/api/adm/referrals/all", {
    params: {
      page,
      // Send both `pageSize` (new standard) and `limit` (legacy) so the
      // backend clamps identically either way.
      ...(opts?.limit && opts.limit > 0
        ? { pageSize: opts.limit, limit: opts.limit }
        : {}),
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
      ...(opts?.stage && opts.stage !== "all" ? { stage: opts.stage } : {}),
      ...(opts?.eligibility && opts.eligibility !== "all"
        ? { eligibility: opts.eligibility }
        : {}),
    },
    signal: opts?.signal,
  });
  const data = res.data as AdmReferralsPage & { rows?: unknown };
  // Defensive: non-array payloads (cached/error shapes) never crash callers.
  if (!Array.isArray(data?.rows)) return { ...data, rows: [] };
  return data;
}

export async function fetchCoordinatorApprovals(
  page = 1,
  opts?: { q?: string; limit?: number; signal?: AbortSignal },
): Promise<AdmApprovalsPage> {
  const res = await apiClient.get<AdmApprovalsPage>("/api/adm/approvals", {
    params: {
      page,
      ...(opts?.limit && opts.limit > 0
        ? { pageSize: opts.limit, limit: opts.limit }
        : {}),
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
    },
    signal: opts?.signal,
  });
  const data = res.data as AdmApprovalsPage & { rows?: unknown };
  if (!Array.isArray(data?.rows)) return { ...data, rows: [] };
  return data;
}

export async function fetchCoordinatorDevices(opts?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
  order?: "oldest" | "newest";
  signal?: AbortSignal;
}): Promise<AdmDevicesPage> {
  const res = await apiClient.get<AdmDevicesPage>("/api/adm/devices", {
    params: {
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
      ...(opts?.status && opts.status !== "all" ? { status: opts.status } : {}),
      ...(opts?.page && opts.page > 1 ? { page: opts.page } : {}),
      ...(opts?.limit && opts.limit > 0
        ? { pageSize: opts.limit, limit: opts.limit }
        : {}),
      ...(opts?.order === "oldest" ? { order: "oldest" } : {}),
    },
    signal: opts?.signal,
  });
  const data = res.data as AdmDevicesPage & { rows?: unknown };
  if (!Array.isArray(data?.rows)) return { ...data, rows: [] };
  return data;
}
