import type { RiskCaseRow } from "@/components/risk-dashboard/risk-dashboard-data";
import { fetchAllGuidanceReferrals } from "@/services/guidance/referrals.service";

export type GuidanceRiskTrack = "Counseling" | "ADM";

export interface GuidanceRiskRow extends RiskCaseRow {

  track: GuidanceRiskTrack;

  referredAt: string;
}

export async function fetchGuidanceRisk(): Promise<{
  rows: GuidanceRiskRow[];
  caseToStudent: Record<string, string | null>;

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
