// Referral queue actions for the guidance desk: paged fetch, full-walk
// fetch, status/accept lifecycle, escalation, reassignment, notes,
// follow-ups, dismissal, specialist referral, ADM initiation.
import { apiClient } from "@/lib/api/client";
import type {
  AcceptReferralInput,
  GuidanceReferralItem,
  GuidanceReferralStatus,
  GuidanceReferralsData,
  GuidanceReferralsParams,
} from "./guidance.types";

export async function fetchGuidanceReferrals(
  params: GuidanceReferralsParams = {},
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceReferralsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.booked) search.set("booked", "1");
  if (params.completed) search.set("completed", "1");
  if (params.open) search.set("open", "1");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.highlight) search.set("highlight", params.highlight);
  const query = search.toString();
  const { data } = await apiClient.get<
    GuidanceReferralsData | GuidanceReferralItem[] | { referrals: GuidanceReferralItem[] }
  >(
    `/api/guidance/referrals${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );
  // Defensive: the endpoint has served bare arrays and {referrals} shapes —
  // never let a shape change crash the table.
  if (Array.isArray(data)) {
    return {
      summary: { total: data.length, pending: 0, inProgress: 0, resolved: 0 },
      referrals: data,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? data.length,
      total: data.length,
      totalPages: 1,
      unfilteredTotal: data.length,
    };
  }
  const referrals = Array.isArray(
    (data as { referrals?: unknown }).referrals
  )
    ? (data as { referrals: GuidanceReferralItem[] }).referrals
    : [];
  return { ...(data as GuidanceReferralsData), referrals };
}

// Every referral on the desk (newest pages first) for client-side tables.
// The endpoint caps pageSize at 100, so walk all pages — filtering and
// paging then happen locally. Optional params (e.g. type) scope the walk
// to the same track a locked page shows.
export async function fetchAllGuidanceReferrals(
  params: GuidanceReferralsParams = {}
): Promise<GuidanceReferralItem[]> {
  const first = await fetchGuidanceReferrals({ ...params, page: 1, pageSize: 100 });
  const all = [...first.referrals];
  for (let p = 2; p <= first.totalPages; p++) {
    const res = await fetchGuidanceReferrals({ ...params, page: p, pageSize: 100 });
    all.push(...res.referrals);
  }
  return all;
}

export async function updateReferralStatus(
  id: string,
  status: GuidanceReferralStatus,
  resolutionSummary?: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/status`, {
    status,
    ...(resolutionSummary ? { resolutionSummary } : {}),
  });
  return data;
}

export async function acceptReferral(
  id: string,
  input: AcceptReferralInput
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/accept`, input);
  return data;
}

export async function escalateReferral(
  id: string,
  escalationReason: string,
  escalatedTo: "principal" | "nurse" | "adm_coordinator"
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/escalate`, {
    escalationReason,
    escalatedTo,
  });
  return data;
}

export async function reassignReferral(
  id: string,
  referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal"
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/reassign`, {
    referredToRole,
  });
  return data;
}

export async function addReferralNote(
  id: string,
  notes: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/note`, { notes });
  return data;
}

export async function flagReferralFollowUp(
  id: string,
  followUpDate: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/follow-up`, {
    followUpDate,
  });
  return data;
}

export async function dismissReferral(
  id: string,
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/dismiss`, {
    reason,
  });
  return data;
}

export async function referToSpecialist(
  id: string,
  referredToRole: "nurse" | "adm_coordinator" | "principal",
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/specialist`, {
    referredToRole,
    reason,
  });
  return data;
}

export async function initiateAdm(
  id: string,
  reason: string
): Promise<unknown> {
  const { data } = await apiClient.post(`/api/referrals/${id}/adm`, {
    reason,
  });
  return data;
}
