import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";

/* Which desk the case came through — a clinic matter or an ADM consultation. */
export type TypeFilter = "" | "Clinic" | "ADM";

export const TYPES: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Clinic", label: "Clinic" },
  { value: "ADM", label: "ADM" },
];

/* Sidebar action menus — ADM and Clinic each get their own menu. Each
   entry filters the timeline to cases of that type in the picked action
   state, with the count on the right. */
export type ActionFilter =
  | ""
  | "adm_needs"
  | "endorse"
  | "followup"
  | "booked"
  | "reject"
  | "clinic_needs"
  | "clinic_booked"
  | "clinic_done"
  | "clinic_followup";

export type ActionValue = Exclude<ActionFilter, "">;

export const ADM_MENU: { value: ActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "followup", label: "Follow-up" },
  { value: "booked", label: "Book session" },
  { value: "reject", label: "Reject" },
];

export const CLINIC_MENU: { value: ActionValue; label: string }[] = [
  { value: "clinic_needs", label: "Needs review" },
  { value: "clinic_booked", label: "Booked session" },
  { value: "clinic_done", label: "Done" },
  { value: "clinic_followup", label: "Follow-up" },
];

export function matchesActionFilter(row: NurseQueueRow, filter: ActionValue): boolean {
  switch (filter) {
    case "adm_needs":
      return row.type === "ADM" && row.status === "pending";
    case "endorse":
      return row.type === "ADM" && isEndorsed(row.type, row.status);
    case "followup":
      return row.type === "ADM" && row.status === "follow_up";
    case "booked":
      return row.type === "ADM" && row.sessions.length > 0;
    case "reject":
      return row.type === "ADM" && row.status === "dismissed";
    case "clinic_needs":
      return row.type === "Clinic" && row.status === "pending";
    case "clinic_booked":
      return row.type === "Clinic" && row.sessions.length > 0;
    case "clinic_done":
      return row.type === "Clinic" && row.sessions.some((s) => s.status === "completed");
    case "clinic_followup":
      return row.type === "Clinic" && row.status === "follow_up";
    default:
      return false;
  }
}

/* "2026-09-12" -> "Sep 12, 2026": long dates confuse non-technical readers. */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

/* Same relative-time tag the folder UI shows under each file. */
export function timeAgo(iso: string): string {
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/* "2026-09-20T06:30:00.000Z" -> "2:30 PM" (reader's timezone). */
export function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* Nurse clinic sessions are always one-on-one talks. */
export function sessionKindLabel(value: string): string {
  if (value === "individual") return "One-on-one";
  return value.replace(/_/g, " ");
}

/* An ADM case in progress is an endorsed case — the nurse desk never
   "handles" ADM consultations, it only endorses them to the coordinator. */
export function isEndorsed(type: string, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

/* Plain words for each case status — "Pending" means little to non-staff. */
export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Needs action";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "escalated":
      return "Sent to clinic";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    case "info_requested":
      return "Needs more info";
    default:
      return status.replace(/_/g, " ");
  }
}

/* Badge text for one row — endorsed ADM cases read "Endorsed", never "In
   progress", so Needs action means exactly the cases waiting on the nurse. */
export function rowStatusLabel(type: string, status: string): string {
  if (isEndorsed(type, status)) return "Endorsed";
  return statusLabel(status);
}

/* One plain line telling the reader what the status means for them. */
export function statusHelp(status: string): string {
  switch (status) {
    case "pending":
      return "Waiting for you to accept this case.";
    case "in_progress":
      return "You accepted this — it is being handled.";
    case "resolved":
      return "Done. Nothing left to do.";
    case "escalated":
      return "This was sent to the clinic for you to handle.";
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

export function rowStatusHelp(type: string, status: string): string {
  if (isEndorsed(type, status)) return "Endorsed — now with the ADM coordinator.";
  return statusHelp(status);
}

/* Backend audit type -> plain label for the left-rail latest action. */
export function labelForActionType(
  actionType: string,
  row: NurseQueueRow,
  alert: NurseAlertItem
): string {
  switch (actionType) {
    case "session_scheduled":
      return "Session booked";
    case "session_completed":
      return "Session done";
    case "session_cancelled":
      return "Session cancelled";
    case "session_rescheduled":
      return "Session moved";
    case "session_document_added":
      return "Documentation filed";
    case "referral_follow_up":
      return "Marked for follow-up";
    case "referral_dismissed":
      return "Rejected";
    case "referral_accepted":
      return "Accepted — handling";
    case "referral_escalated":
      return "Sent to clinic";
    case "referral_status_change":
      if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator";
      if (row.status === "follow_up") return "Marked for follow-up";
      if (row.status === "resolved") return "Resolved";
      if (row.status === "dismissed") return "Rejected";
      return alert.title;
    default:
      return alert.title;
  }
}

/* Latest action on the case for the left rail, with its EXECUTION time.
   Prefers the backend audit time (when the action ran); never shows the
   future appointment time as the action time. Falls back to session
   execution stamps (createdAt/completedAt) and finally the referral date
   for legacy rows without an audit trail. */
export function latestActionOf(
  row: NurseQueueRow,
  alert: NurseAlertItem
): { label: string; time: string } {
  if (row.sessions.length > 0) {
    const sorted = [...row.sessions].sort((a, b) => {
      const at = new Date(a.createdAt || a.scheduledAt).getTime();
      const bt = new Date(b.createdAt || b.scheduledAt).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const latest = sorted[0];
    if (latest.status === "completed" && row.followUpDate) {
      return { label: "Marked for follow-up", time: row.followUpDate };
    }
    if (latest.status === "completed") {
      return { label: "Session done", time: latest.createdAt || latest.scheduledAt };
    }
    if (latest.status === "cancelled") {
      return { label: "Session cancelled", time: latest.createdAt || latest.scheduledAt };
    }
    return { label: "Session booked", time: latest.createdAt || latest.scheduledAt };
  }
  if (row.lastActionAt) {
    return { label: labelForActionType(row.lastActionType, row, alert), time: row.lastActionAt };
  }
  if (row.followUpDate) return { label: "Marked for follow-up", time: row.followUpDate };
  if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator", time: row.date };
  if (row.status === "dismissed") return { label: "Rejected", time: row.date };
  if (row.status === "resolved") return { label: "Resolved", time: row.date };
  return { label: alert.title, time: row.date };
}

/* "2026-09-14" -> "Sep 14, 2026"; full ISO -> "Sep 14, 2026 · 2:30 PM".
   The date part renders in the reader's local timezone (same clock as the
   time part) — never UTC — so the displayed day matches when the action
   actually ran. */
export function formatActionTime(value: string): string {
  if (!value || value === "—") return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatDate(localDay)} · ${formatTime(value)}`;
}

export function statusVariant(
  type: string,
  status: string
): "warning" | "destructive" | "secondary" | "outline" | "success" {
  if (isEndorsed(type, status)) return "success";
  if (status === "pending") return "warning";
  if (status === "escalated") return "destructive";
  if (status === "resolved" || status === "dismissed") return "secondary";
  return "outline";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function activeSessionOf(sessions: NurseSessionItem[]): NurseSessionItem | null {
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

/* One active session per referral — booking waits while a scheduled session
   exists (server enforces this too; the button disables early). */
export function hasScheduledSession(sessions: NurseSessionItem[]): boolean {
  return sessions.some((s) => s.status === "scheduled");
}

/* Watermark label for the diagonal background on each referral entry.
   Matches the sidebar action menu labels so the reader sees the
   same wording in the watermark as in the filters. */
export function watermarkLabel(row: NurseQueueRow): string {
  if (isEndorsed(row.type, row.status)) return "Endorse";
  if (row.status === "dismissed") return "Reject";
  if (row.status === "resolved") return "Done";
  if (row.status === "follow_up") return "Follow-up";
  if (hasScheduledSession(row.sessions)) return "Booked session";
  if (row.status === "pending") return "Needs review";
  return rowStatusLabel(row.type, row.status);
}

/* Watermark color class suffix for each status — maps to CSS
   classes that give each status its own distinct color. */
export function watermarkColor(row: NurseQueueRow): string {
  if (isEndorsed(row.type, row.status)) return "endorse";
  if (row.status === "dismissed") return "reject";
  if (row.status === "resolved") return "done";
  if (row.status === "follow_up") return "followup";
  if (hasScheduledSession(row.sessions)) return "booked";
  if (row.status === "pending") return "needsreview";
  return "";
}

/* A clinic session unlocks once its scheduled time arrives (ongoing or
   past). Still-upcoming sessions can be moved/cancelled but cannot be
   marked done and cannot take documentation yet. */
export function isSessionStarted(scheduledAt: string, now: number): boolean {
  const at = new Date(scheduledAt).getTime();
  if (!Number.isFinite(at)) return false;
  return at <= now;
}

/* "1d 04:03:22" / "04:03:22" — always with seconds, tabular-nums. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
