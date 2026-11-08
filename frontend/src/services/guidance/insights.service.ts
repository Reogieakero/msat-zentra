import { apiClient } from "@/lib/api/client";
import type { InterventionInsightsData } from "./insights.types";

export async function fetchGuidanceInterventionInsights(
  signal?: AbortSignal,
): Promise<InterventionInsightsData> {
  const { data } = await apiClient.get<InterventionInsightsData>(
    "/api/guidance/intervention-insights",
    { signal },
  );
  return data;
}
