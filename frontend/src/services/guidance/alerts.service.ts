import { apiClient } from "@/lib/api/client";
import type {
  GuidanceAlertCasesData,
  GuidanceAlertCasesParams,
  GuidanceAlertsData,
  GuidanceAlertsParams,
} from "./alerts.types";

export async function fetchGuidanceAlerts(
  params: GuidanceAlertsParams = {}
): Promise<GuidanceAlertsData> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.level) search.set("level", params.level);
  if (params.factor) search.set("factor", params.factor);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceAlertsData>(
    `/api/guidance/alerts${query ? `?${query}` : ""}`
  );
  return data;
}

/**
 * Merged alerts desk: guidance referrals + the live intervention cohort in one
 * server-paged response. Filters, search and paging all happen server-side.
 */
export async function fetchGuidanceAlertCases(
  params: GuidanceAlertCasesParams = {},
  opts: { signal?: AbortSignal } = {}
): Promise<GuidanceAlertCasesData> {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.risk) search.set("risk", params.risk);
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const { data } = await apiClient.get<GuidanceAlertCasesData>(
    `/api/guidance/alerts/cases${query ? `?${query}` : ""}`,
    { signal: opts.signal }
  );
  return data;
}
