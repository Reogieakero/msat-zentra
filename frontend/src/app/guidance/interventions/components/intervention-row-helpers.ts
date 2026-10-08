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
export function pipelineStatus(
  row: AtRiskStudentItem,
  followUp: AtRiskStudentItem["intervention"],
  scheduledCount: number,
  doneCount: number
): {
  label: string;
  variant: "default" | "success" | "secondary" | "destructive" | "outline" | "warning";
  sub: string | null;
} {
  if (followUp?.outcomeStatus === "resolved")
    return { label: "Done", variant: "success", sub: null };
  if (followUp?.outcomeStatus === "unresolved")
    return { label: "Discontinued", variant: "secondary", sub: null };
  if (followUp && row.riskLevel === "Low")
    return { label: "No longer at risk", variant: "secondary", sub: "Risk factors cleared" };
  if (!followUp || followUp.sessions.length === 0)
    return { label: "No action yet", variant: "outline", sub: null };
  if (scheduledCount > 0 && doneCount > 0)
    return {
      label: "Follow-up session",
      variant: "default",
      sub: `${doneCount} session${doneCount === 1 ? "" : "s"} done`,
    };
  if (scheduledCount > 0) return { label: "Booked session", variant: "default", sub: null };
  if (doneCount > 0)
    return {
      label: "Session done",
      variant: "success",
      sub: `${doneCount} session${doneCount === 1 ? "" : "s"} done`,
    };
  return { label: "No action yet", variant: "outline", sub: null };
}
