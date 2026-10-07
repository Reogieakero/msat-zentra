// Principal overview dashboard fetch.
import { apiClient } from "@/lib/api/client";
import type { OverviewData } from "./overview.types";

export async function fetchOverview(): Promise<OverviewData> {
  const { data } = await apiClient.get<OverviewData>("/api/overview");
  return data;
}
