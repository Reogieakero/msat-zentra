// Dashboard fetch for the guidance overview page.
import { apiClient } from "@/lib/api/client";
import type { GuidanceOverviewData } from "./overview.types";

export async function fetchGuidanceOverview(
  signal?: AbortSignal
): Promise<GuidanceOverviewData> {
  const { data } = await apiClient.get<GuidanceOverviewData>(
    "/api/guidance/overview",
    { signal }
  );
  return data;
}
