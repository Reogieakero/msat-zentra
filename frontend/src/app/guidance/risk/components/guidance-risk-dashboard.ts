import type { RiskCaseRow } from "@/components/risk-dashboard/risk-dashboard-data";
import { fetchAllGuidanceReferrals } from "../../referrals/components/guidance-referrals-data";

/**
 * Guidance risk dashboard data — desk-scoped only.
 *
 * Mirrors the nurse risk board: every number rebuilds client-side from the
 * guidance desk's own referrals (counseling + ADM tracks) plus the
 * per-student risk-level projection guidance may read
 * (`GET /api/risk/students/:id` → { lrn, riskLevel }). Counts and levels
 * only — never confidential notes from other roles, never principal
 * `/api/risk/*` aggregates.
 */

export type GuidanceRiskTrack = "Counseling" | "ADM";

export interface GuidanceRiskRow extends RiskCaseRow {
  /** Referral track — "Counseling" for direct guidance cases, "ADM" for
      ADM-track cases picked for guidance consultation review. */
  track: GuidanceRiskTrack;
}

export async function fetchGuidanceRisk(): Promise<{
  rows: GuidanceRiskRow[];
  caseToStudent: Record<string, string | null>;
}> {
  const referrals = await fetchAllGuidanceReferrals();
  const rows: GuidanceRiskRow[] = referrals.map((r) => ({
    id: r.id,
    section: r.section,
    category: r.category,
    track: r.type === "ADM" ? "ADM" : "Counseling",
  }));
  const caseToStudent: Record<string, string | null> = {};
  for (const r of referrals) {
    caseToStudent[r.id] = r.studentId;
  }
  return { rows, caseToStudent };
}
