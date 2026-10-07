import type { RiskCaseRow } from "@/components/risk-dashboard/risk-dashboard-data";
import { fetchAllGuidanceReferrals } from "@/services/guidance/referrals.service";

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
  /** When the case was referred — drives the weekly trend lines. */
  referredAt: string;
}

export async function fetchGuidanceRisk(): Promise<{
  rows: GuidanceRiskRow[];
  caseToStudent: Record<string, string | null>;
  /** Referral id → display name, for the plain-words watch card. */
  referralToName: Record<string, string>;
}> {
  const referrals = await fetchAllGuidanceReferrals();
  const rows: GuidanceRiskRow[] = referrals.map((r) => ({
    id: r.id,
    section: r.section,
    category: r.category,
    track: r.type === "ADM" ? "ADM" : "Counseling",
    referredAt: r.date,
  }));
  const caseToStudent: Record<string, string | null> = {};
  const referralToName: Record<string, string> = {};
  for (const r of referrals) {
    caseToStudent[r.id] = r.studentId;
    referralToName[r.id] = r.student;
  }
  return { rows, caseToStudent, referralToName };
}
