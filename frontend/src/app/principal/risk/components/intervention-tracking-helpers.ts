import type { RiskLevelKey } from "@/services/principal/risk.types";
export type OutcomeStatus = "ongoing" | "resolved" | "unresolved";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "modified";
export interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatus;
  outcomeStatus: OutcomeStatus;
  createdAt: string | null;
  sessions: { status: string }[];
}
export interface InterventionStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  riskLevel: RiskLevelKey;
  intervention: InterventionLink | null;
}
export const SECTION_LABEL: Record<OutcomeStatus, string> = {
  ongoing: "Ongoing",
  resolved: "Resolved",
  unresolved: "Unresolved",
};
export const OUTCOME_VARIANT: Record<OutcomeStatus, "warning" | "outline" | "destructive"> = {
  ongoing: "warning",
  resolved: "outline",
  unresolved: "destructive",
};
export function pipelineStatus(link: InterventionLink | null): {
  label: string;
  variant: "warning" | "outline" | "destructive";
} {
  if (!link) return { label: "—", variant: "outline" };
  if (link.outcomeStatus !== "ongoing") {
    return {
      label: SECTION_LABEL[link.outcomeStatus],
      variant: OUTCOME_VARIANT[link.outcomeStatus],
    };
  }
  if (link.sessions.length === 0) {
    return { label: "No action yet", variant: "outline" };
  }
  return { label: SECTION_LABEL.ongoing, variant: OUTCOME_VARIANT.ongoing };
}
export const RISK_VARIANT: Record<string, "red" | "amber" | "green"> = {
  High: "red",
  Moderate: "amber",
  Low: "green",
};
export const PAGE_SIZE = 8;
export const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};
