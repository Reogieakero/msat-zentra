"use client";
import type { AtRiskStudentItem, CounselingSessionItem } from "@/services/guidance/interventions.types";
export function approvalLabel(value: string): string {
  switch (value) {
    case "pending":
      return "Waiting for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "modified":
      return "Changed";
    default:
      return value;
  }
}
export function outcomeLabel(value: string): string {
  switch (value) {
    case "ongoing":
      return "Ongoing";
    case "resolved":
      return "Resolved";
    case "unresolved":
      return "Not resolved";
    default:
      return value;
  }
}
export function interventionLatestAction(item: AtRiskStudentItem): {
  label: string;
  time: string;
} {
  const iv = item.intervention;
  if (iv && iv.sessions.length > 0) {
    const actionTimeOf = (s: CounselingSessionItem) =>
      s.completedAt || s.createdAt || s.scheduledAt;
    const sorted = [...iv.sessions].sort((a, b) => {
      const at = new Date(actionTimeOf(a)).getTime();
      const bt = new Date(actionTimeOf(b)).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed") {
      return { label: "Session done", time: newest.completedAt || newest.createdAt || newest.scheduledAt };
    }
    if (newest.status === "cancelled") {
      return { label: "Session cancelled", time: newest.createdAt || newest.scheduledAt };
    }
    return { label: "Session booked", time: newest.createdAt || newest.scheduledAt };
  }
  if (iv?.createdAt) return { label: "Intervention opened", time: iv.createdAt };
  return { label: "No follow-up yet", time: "" };
}
/**
 * The single case-status ladder used by the board's status filter and by the
 * card pill. Order is the precedence used everywhere: a closed case wins over
 * sessions, a cleared risk wins over "no action".
 */
export type InterventionStatusKey =
  | "no_action"
  | "booked"
  | "session_done"
  | "follow_up"
  | "risk_cleared"
  | "done"
  | "discontinued";

export type InterventionStatusFilter = InterventionStatusKey | "all";

export function interventionStatusKey(
  row: AtRiskStudentItem,
  followUp: AtRiskStudentItem["intervention"] = row.intervention,
  scheduledCount: number = followUp?.sessions.filter((s) => s.status === "scheduled").length ?? 0,
  doneCount: number = followUp?.completedSessions ?? 0
): InterventionStatusKey {
  if (followUp?.outcomeStatus === "resolved") return "done";
  if (followUp?.outcomeStatus === "unresolved") return "discontinued";
  if (followUp && row.riskLevel === "Low") return "risk_cleared";
  if (!followUp || followUp.sessions.length === 0) return "no_action";
  if (scheduledCount > 0 && doneCount > 0) return "follow_up";
  if (scheduledCount > 0) return "booked";
  if (doneCount > 0) return "session_done";
  return "no_action";
}

export function pipelineStatus(
  row: AtRiskStudentItem,
  followUp: AtRiskStudentItem["intervention"],
  scheduledCount: number,
  doneCount: number
): {
  label: string;
  variant: "default" | "success" | "secondary" | "destructive" | "outline" | "warning" | "green";
  sub: string | null;
} {
  const sessionsDone = `${doneCount} session${doneCount === 1 ? "" : "s"} done`;
  switch (interventionStatusKey(row, followUp, scheduledCount, doneCount)) {
    case "done":
      return { label: "Done", variant: "green", sub: null };
    case "discontinued":
      return { label: "Discontinued", variant: "secondary", sub: null };
    case "risk_cleared":
      return {
        label: "No longer at risk",
        variant: "secondary",
        sub: "Risk factors cleared",
      };
    case "follow_up":
      return { label: "Follow-up session", variant: "default", sub: sessionsDone };
    case "booked":
      return { label: "Booked session", variant: "default", sub: null };
    case "session_done":
      return { label: "Session done", variant: "green", sub: sessionsDone };
    default:
      return { label: "No action yet", variant: "outline", sub: null };
  }
}
