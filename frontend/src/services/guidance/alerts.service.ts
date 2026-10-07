// Alert feed fetch for the guidance desk.
import { apiClient } from "@/lib/api/client";
import type { GuidanceAlertsData, GuidanceAlertsParams } from "./alerts.types";

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
