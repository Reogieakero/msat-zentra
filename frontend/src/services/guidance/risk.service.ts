// Live rule-based risk levels for the guidance desk. Never throws — ids
// with no result are simply absent from the map (table shows "—").
import { apiClient } from "@/lib/api/client";
import type { GuidanceRiskLevel } from "./guidance.types";

// Live rule-based risk level per referred student (GET /api/risk/students/:id
// → { lrn, riskLevel }). The guidance role is allowed this limited
// projection, and the endpoint serves roster ids too — pass the referral's
// studentId (account or roster) so every row resolves a level.
// Resolves each id independently so one failure never blocks the rest;
// ids with no result are simply absent from the map (table shows "—").
export async function fetchGuidanceRiskLevels(
  studentIds: string[]
): Promise<Record<string, GuidanceRiskLevel>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const settled = await Promise.allSettled(
    unique.map(async (id) => {
      const { data } = await apiClient.get<{ lrn: string; riskLevel: GuidanceRiskLevel }>(
        `/api/risk/students/${id}`
      );
      return { id, riskLevel: data?.riskLevel ?? null };
    })
  );
  const map: Record<string, GuidanceRiskLevel> = {};
  for (const s of settled) {
    if (
      s.status === "fulfilled" &&
      s.value.riskLevel !== null &&
      (s.value.riskLevel === "High" ||
        s.value.riskLevel === "Moderate" ||
        s.value.riskLevel === "Low")
    ) {
      map[s.value.id] = s.value.riskLevel;
    }
  }
  return map;
}
