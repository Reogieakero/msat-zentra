import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "@/services/guidance/guidance.types";
import {
  isEndorsed,
  latestActionOf,
} from "../../referrals/components/guidance-referrals-format";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
export type GuidanceAlertRow =
  | { kind: "referral"; referral: GuidanceReferralItem }
  | { kind: "intervention"; item: AtRiskStudentItem };
export type TypeFilter = "" | "ADM" | "Counseling" | "Intervention";
export function liveLatestActionOf(row: GuidanceReferralItem): { label: string; time: string } {
  const audit = latestActionOf(row);
  if (row.sessions.length === 0) return audit;
  const sorted = [...row.sessions].sort((a, b) => {
    const at = new Date(a.createdAt || a.scheduledAt).getTime();
    const bt = new Date(b.createdAt || b.scheduledAt).getTime();
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return bt - at;
  });
  const newest = sorted[0];
  let label: string;
  let time: string;
  if (newest.status === "completed" && row.followUpDate) {
    label = "Marked for follow-up";
    time = row.followUpDate;
  } else if (newest.status === "completed") {
    label = "Session done";
    time = newest.createdAt || newest.scheduledAt;
  } else if (newest.status === "cancelled") {
    label = "Session cancelled";
    time = newest.createdAt || newest.scheduledAt;
  } else {
    label = "Session booked";
    time = newest.createdAt || newest.scheduledAt;
  }
  const sessionMs = new Date(time).getTime();
  const auditMs = row.lastActionAt ? new Date(row.lastActionAt).getTime() : NaN;
  if (Number.isFinite(auditMs) && (!Number.isFinite(sessionMs) || auditMs > sessionMs)) {
    return audit;
  }
  return { label, time };
}
export function interventionLatestAction(item: AtRiskStudentItem): { label: string; time: string } {
  const iv = item.intervention;
  if (iv && iv.sessions.length > 0) {
    const actionTimeOf = (s: { completedAt: string; createdAt: string; scheduledAt: string }) =>
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
  if (!iv) return { label: "Just detected", time: "" };
  return { label: "Intervention recorded", time: "" };
}
export function rowLatest(row: GuidanceAlertRow): { label: string; time: string } {
  return row.kind === "referral"
    ? liveLatestActionOf(row.referral)
    : interventionLatestAction(row.item);
}
export function actionTimeOf(row: GuidanceAlertRow): number | null {
  const { time } = rowLatest(row);
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}
export function referralStatusVariant(
  type: string,
  status: string
): "amber" | "default" | "secondary" | "outline" | "destructive" | "success" {
  if (isEndorsed(type, status)) return "success";
  switch (status) {
    case "pending":
      return "amber";
    case "in_progress":
      return "default";
    case "follow_up":
      return "secondary";
    case "info_requested":
      return "outline";
    case "escalated":
      return "destructive";
    case "resolved":
      return "success";
    case "dismissed":
      return "secondary";
    default:
      return "outline";
  }
}
export function asLevel(value: string | undefined): GuidanceRiskLevel | undefined {
  return value === "High" || value === "Moderate" || value === "Low" ? value : undefined;
}
export function rowKey(row: GuidanceAlertRow): string {
  return row.kind === "referral" ? `referral:${row.referral.id}` : `intervention:${row.item.studentKey}`;
}
export function rowSearchText(row: GuidanceAlertRow): string {
  if (row.kind === "referral") {
    const r = row.referral;
    return `${r.student} ${r.lrn} ${r.section} ${r.reason} ${r.category}`;
  }
  const s = row.item;
  return `${s.student} ${s.lrn} ${s.section} ${s.intervention?.recommendedAction ?? ""} ${s.intervention?.assignee ?? ""}`;
}
export function rowRisk(row: GuidanceAlertRow, riskByStudent: Record<string, GuidanceRiskLevel>) {
  if (row.kind === "referral") {
    const id = row.referral.studentId;
    return id ? riskByStudent[id] : undefined;
  }
  return asLevel(row.item.riskLevel);
}
export function rowType(row: GuidanceAlertRow): TypeFilter {
  if (row.kind === "referral") {
    return row.referral.type === "ADM" ? "ADM" : "Counseling";
  }
  return "Intervention";
}
