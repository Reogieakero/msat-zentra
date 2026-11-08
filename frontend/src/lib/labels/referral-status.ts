import { formatStatus } from "./text";
import type { PillTone } from "@/components/ui/pill";

export const NURSE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  in_progress: "In progress",
  follow_up: "Follow-up",
  info_requested: "Needs info",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
export const STATUS_BADGE_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  dismissed: "Cancelled",
  escalated: "Escalated",
  info_requested: "Info Requested",
  follow_up: "Follow Up",
};
export function isEndorsed(type: string, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

/** Referral status → shared chip tone (matches the legend on the referral desk). */
export const REFERRAL_STATUS_TONE: Record<string, PillTone> = {
  pending: "amber",
  in_progress: "blue",
  info_requested: "blue",
  follow_up: "amber",
  resolved: "green",
  dismissed: "red",
  rejected: "red",
};

export function referralStatusTone(status: string): PillTone {
  return REFERRAL_STATUS_TONE[status] ?? "neutral";
}

/** Legend rows for the referral status chips — `hint` feeds the pill tooltip. */
export const REFERRAL_STATUS_LEGEND: {
  key: string;
  label: string;
  hint: string;
  tone: PillTone;
}[] = [
  { key: "pending", label: "Pending", hint: "Submitted — waiting for the receiving desk", tone: "amber" },
  { key: "in_progress", label: "In progress", hint: "The receiving desk is handling the referral", tone: "blue" },
  { key: "info_requested", label: "Info requested", hint: "The desk needs more information before acting", tone: "blue" },
  { key: "follow_up", label: "Follow up", hint: "Still being watched after a first response", tone: "amber" },
  { key: "resolved", label: "Resolved", hint: "Closed with a recorded outcome", tone: "green" },
  { key: "dismissed", label: "Cancelled", hint: "Withdrawn before the desk acted", tone: "red" },
  { key: "rejected", label: "Rejected", hint: "Declined by the receiving desk", tone: "red" },
];
export function isWithdrawn(row: { status: string; dismissedByRole?: string | null }): boolean {
  return (
    row.status === "dismissed" &&
    (row.dismissedByRole === "adviser" || row.dismissedByRole === "subject_teacher")
  );
}
export function hasScheduledSession(sessions: { status?: string | null }[]): boolean {
  return sessions.some((s) => s.status === "scheduled");
}

type CaseStateShape = {
  status: string;
  sessions: { status?: string | null }[];
  dismissedByRole?: string | null;
};

/**
 * A case is Done once it is resolved or has a completed session. Follow-up
 * cases are owned by the Follow-up lens, and cancelled/rejected cases are
 * never Done — so the card badge and the Done tab always agree.
 */
export function isCaseDone(row: CaseStateShape): boolean {
  if (row.status === "follow_up" || row.status === "dismissed") return false;
  if (row.status === "resolved") return true;
  return row.sessions.some((s) => s.status === "completed");
}

/**
 * "Booked session" means an open case with an upcoming scheduled session.
 * Done cases keep their completed session rows, so counting every case that
 * has sessions would leak them into the Booked lens.
 */
export function hasOpenBooking(row: CaseStateShape): boolean {
  if (row.status === "follow_up" || row.status === "resolved" || row.status === "dismissed") {
    return false;
  }
  if (row.sessions.some((s) => s.status === "completed")) return false;
  return row.sessions.some((s) => s.status === "scheduled");
}
export function activeSessionOf<T extends { status: string; scheduledAt: string }>(sessions: T[]): T | null {
  const actives = sessions
    .filter((s) => s.status === "scheduled")
    .slice()
    .sort((a, b) => {
      const at = new Date(a.scheduledAt).getTime();
      const bt = new Date(b.scheduledAt).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return at - bt;
    });
  return actives[0] ?? null;
}
/** Newest session by scheduled time — apps use it to read the latest state
    of a case's plan (e.g. a cancelled most recent session). */
export function latestSessionOf<T extends { scheduledAt: string }>(sessions: T[]): T | null {
  let latest: T | null = null;
  let latestAt = -Infinity;
  for (const session of sessions) {
    const at = new Date(session.scheduledAt).getTime();
    const value = Number.isFinite(at) ? at : -Infinity;
    if (value >= latestAt) {
      latestAt = value;
      latest = session;
    }
  }
  return latest;
}
export function statusLabel(status: string, opts?: { escalatedText?: string; rawFallback?: boolean }): string {
  switch (status) {
    case "pending":
      return "Needs action";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "escalated":
      return opts?.escalatedText ?? "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    case "info_requested":
      return "Needs more info";
    default:
      if (opts?.rawFallback) return status.replace(/_/g, " ");
      return formatStatus(status);
  }
}
export function statusHelp(status: string, opts?: { escalatedHelp?: string }): string {
  switch (status) {
    case "pending":
      return "Waiting for you to accept this case.";
    case "in_progress":
      return "You accepted this — it is being handled.";
    case "resolved":
      return "Done. Nothing left to do.";
    case "escalated":
      return opts?.escalatedHelp ?? "This was sent to a higher office.";
    case "follow_up":
      return "Check back on the follow-up date below.";
    case "dismissed":
      return "Closed without further action.";
    case "info_requested":
      return "Waiting for more information.";
    default:
      return "";
  }
}
export function rowStatusLabel(
  type: string,
  status: string,
  row?: { status: string; dismissedByRole?: string | null },
  opts?: { escalatedText?: string; rawFallback?: boolean }
): string {
  if (isEndorsed(type, status)) return "Endorsed";
  if (row && isWithdrawn(row)) return "Cancelled";
  return statusLabel(status, opts);
}
export function rowStatusHelp(
  type: string,
  status: string,
  row?: { status: string; dismissedByRole?: string | null },
  opts?: { endorsedHelp?: string; withdrawnHelp?: string; escalatedHelp?: string }
): string {
  if (isEndorsed(type, status)) return opts?.endorsedHelp ?? "Endorsed — now with the ADM coordinator.";
  if (row && isWithdrawn(row)) return opts?.withdrawnHelp ?? "Withdrawn by the filing teacher — no further action.";
  return statusHelp(status, { escalatedHelp: opts?.escalatedHelp });
}
export function statusVariant(
  type: string,
  status: string,
  row?: { status: string; dismissedByRole?: string | null }
): "amber" | "destructive" | "secondary" | "outline" | "success" {
  if (isEndorsed(type, status)) return "success";
  if (status === "pending") return "amber";
  if (status === "escalated") return "destructive";
  if (status === "dismissed") return row && isWithdrawn(row) ? "outline" : "destructive";
  if (status === "resolved") return "secondary";
  return "outline";
}
export function watermarkLabel(
  row: { type: string; status: string; sessions: { status?: string | null }[]; dismissedByRole?: string | null },
  opts?: { escalatedText?: string; rawFallback?: boolean }
): string {
  if (isEndorsed(row.type, row.status)) return "Endorse";
  if (isWithdrawn(row)) return "Cancelled";
  if (row.status === "dismissed") return "Reject";
  if (row.status === "resolved") return "Done";
  if (row.status === "follow_up") return "Follow-up";
  if (hasScheduledSession(row.sessions)) return "Booked session";
  if (row.status === "pending") return "Needs review";
  return rowStatusLabel(row.type, row.status, undefined, opts);
}
export function watermarkColor(row: { type: string; status: string; sessions: { status?: string | null }[]; dismissedByRole?: string | null }): string {
  if (isEndorsed(row.type, row.status)) return "endorse";
  if (isWithdrawn(row)) return "cancelled";
  if (row.status === "dismissed") return "reject";
  if (row.status === "resolved") return "done";
  if (row.status === "follow_up") return "followup";
  if (hasScheduledSession(row.sessions)) return "booked";
  if (row.status === "pending") return "needsreview";
  return "";
}
export function deriveActionStatus(
  type: string,
  status: string,
  sessions: { status?: string | null }[]
): { key: string; label: string } {
  const hasScheduled = sessions.some((s) => s.status === "scheduled");
  const hasCompleted = sessions.some((s) => s.status === "completed");
  const isEndorsedCase = type === "ADM" && status === "in_progress";
  if (isEndorsedCase) return { key: "endorsed", label: "Endorsed" };
  if (status === "dismissed") return { key: "rejected", label: "Rejected" };
  if (status === "resolved") return { key: "done", label: "Done" };
  if (status === "follow_up") return { key: "followup", label: "Follow-up" };
  if (hasScheduled) return { key: "booked", label: "Booked session" };
  if (hasCompleted) return { key: "done_session", label: "Done session" };
  if (status === "pending") return { key: "needs_review", label: "Needs review" };
  if (status === "escalated") return { key: "escalated", label: "Escalated" };
  return { key: status, label: NURSE_STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1)) };
}
export function chartBucketFor(
  type: string,
  status: string,
  sessions: { status?: string | null }[]
): { key: string; label: string } {
  const list = sessions ?? [];
  const hasScheduled = list.some((s) => s.status === "scheduled");
  const hasCompleted = list.some((s) => s.status === "completed");
  if (type === "ADM" && status === "in_progress") return { key: "endorsed", label: "Endorsed" };
  if (status === "dismissed") return { key: "rejected", label: "Rejected" };
  if (status === "resolved") return { key: "done", label: "Done" };
  if (status === "follow_up") return { key: "followup", label: "Follow-up" };
  if (hasScheduled) return { key: "booked", label: "Booked session" };
  if (hasCompleted) return { key: "done", label: "Done" };
  if (list.length > 0) return { key: "booked", label: "Booked session" };
  return { key: "needs_review", label: "Needs review" };
}
export function queueStatus(row: { reviewed?: boolean; referralStatus: string }): { label: string; variant: "warning" | "success" | "destructive" | "secondary" } {
  if (row.reviewed === false) return { label: "Needs review", variant: "warning" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", variant: "destructive" };
  if (row.referralStatus === "in_progress") return { label: "Endorsed", variant: "success" };
  return { label: "Reviewed", variant: "secondary" };
}
export function queueLatest(row: { reviewed?: boolean; referralStatus: string }): { label: string; icon: "eye" | "send" } {
  if (row.reviewed === false) return { label: "Waiting on your review", icon: "eye" };
  if (row.referralStatus === "dismissed") return { label: "Rejected", icon: "send" };
  return { label: "Endorsed to ADM coordinator", icon: "send" };
}
