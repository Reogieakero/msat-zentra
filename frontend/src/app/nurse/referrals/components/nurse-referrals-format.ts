import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { actorActionLabel } from "@/lib/notifications/action-label";

/* Folder body color per anecdotal category — mirrors the teacher
   anecdotal repository (AnecdotalSideRail CATEGORY_COLORS) so the same
   category carries the same color on every desk. */
export const ANECDOTAL_CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

/* Resolve the folder color for a (Title Case or raw) category label —
   undefined falls back to the FolderCard gray. */
export function anecdotalCategoryColor(category: string | null | undefined): string | undefined {
  if (!category) return undefined;
  return ANECDOTAL_CATEGORY_COLORS[category.trim().toLowerCase()];
}

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
  | "adm_cancelled"
  | "clinic_needs"
  | "clinic_booked"
  | "clinic_done"
  | "clinic_followup"
  | "clinic_cancelled";

export type ActionValue = Exclude<ActionFilter, "">;

export const ADM_MENU: { value: ActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "followup", label: "Follow-up" },
  { value: "booked", label: "Book session" },
  { value: "reject", label: "Reject" },
  { value: "adm_cancelled", label: "Cancelled" },
];

export const CLINIC_MENU: { value: ActionValue; label: string }[] = [
  { value: "clinic_needs", label: "Needs review" },
  { value: "clinic_booked", label: "Booked session" },
  { value: "clinic_done", label: "Done" },
  { value: "clinic_followup", label: "Follow-up" },
  { value: "clinic_cancelled", label: "Cancelled" },
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
      return row.type === "ADM" && row.status === "dismissed" && !isWithdrawn(row);
    case "adm_cancelled":
      return row.type === "ADM" && isWithdrawn(row);
    case "clinic_needs":
      return row.type === "Clinic" && row.status === "pending";
    case "clinic_booked":
      return row.type === "Clinic" && row.sessions.length > 0;
    case "clinic_done":
      return row.type === "Clinic" && row.sessions.some((s) => s.status === "completed");
    case "clinic_followup":
      return row.type === "Clinic" && row.status === "follow_up";
    case "clinic_cancelled":
      return row.type === "Clinic" && isWithdrawn(row);
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
   progress", so Needs action means exactly the cases waiting on the nurse.
   Withdrawn cases read "Cancelled" (pass the row); desk decisions read
   "Closed". */
export function rowStatusLabel(type: string, status: string, row?: NurseQueueRow): string {
  if (isEndorsed(type, status)) return "Endorsed";
  if (row && isWithdrawn(row)) return "Cancelled";
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

export function rowStatusHelp(type: string, status: string, row?: NurseQueueRow): string {
  if (isEndorsed(type, status)) return "Endorsed — now with the ADM coordinator.";
  if (row && isWithdrawn(row)) return "Withdrawn by the filing teacher — no further action.";
  return statusHelp(status);
}

/* Backend audit type -> plain label for the left-rail latest action.
   Actor-first wording shared with every desk (see action-label.ts):
   "Cancelled by adviser", "Session booked by School Nurse", ... */
export function labelForActionType(
  actionType: string,
  row: NurseQueueRow,
  alert: NurseAlertItem
): string {
  const fallback = alert.title;
  const newestSession = [...row.sessions].sort((a, b) => {
    const at = new Date(a.createdAt || a.scheduledAt).getTime();
    const bt = new Date(b.createdAt || b.scheduledAt).getTime();
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return bt - at;
  })[0];
  switch (actionType) {
    case "session_scheduled":
    case "session_completed":
    case "session_rescheduled":
    case "session_document_added":
    case "referral_follow_up":
    case "referral_accepted":
    case "referral_escalated":
      return actorActionLabel({ scope: "nurse", action: actionType, fallback });
    case "session_cancelled":
      return actorActionLabel({
        scope: "nurse",
        action: actionType,
        cancelledByRole: newestSession?.cancelledByRole ?? null,
        fallback,
      });
    case "referral_dismissed":
      return actorActionLabel({
        scope: "nurse",
        action: actionType,
        withdrawn: isWithdrawn(row),
        fallback,
      });
    case "referral_status_change":
      if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator by School Nurse";
      if (row.status === "follow_up") return "Marked for follow-up by School Nurse";
      if (row.status === "resolved") return "Resolved by School Nurse";
      if (row.status === "dismissed")
        return actorActionLabel({
          scope: "nurse",
          action: "referral_dismissed",
          withdrawn: isWithdrawn(row),
          fallback,
        });
      return fallback;
    default:
      return fallback;
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
      return { label: "Marked for follow-up by School Nurse", time: row.followUpDate };
    }
    if (latest.status === "completed") {
      return {
        label: actorActionLabel({ scope: "nurse", action: "session_completed", fallback: "Session done" }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    if (latest.status === "cancelled") {
      return {
        label: actorActionLabel({
          scope: "nurse",
          action: "session_cancelled",
          cancelledByRole: latest.cancelledByRole ?? null,
          fallback: "Session cancelled",
        }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    return {
      label: actorActionLabel({ scope: "nurse", action: "session_scheduled", fallback: "Session booked" }),
      time: latest.createdAt || latest.scheduledAt,
    };
  }
  if (row.lastActionAt) {
    return { label: labelForActionType(row.lastActionType, row, alert), time: row.lastActionAt };
  }
  if (row.followUpDate) return { label: "Marked for follow-up by School Nurse", time: row.followUpDate };
  if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator by School Nurse", time: row.date };
  if (row.status === "dismissed")
    return {
      label: actorActionLabel({
        scope: "nurse",
        action: "referral_dismissed",
        withdrawn: isWithdrawn(row),
        fallback: "Rejected",
      }),
      time: row.date,
    };
  if (row.status === "resolved") return { label: "Resolved by School Nurse", time: row.date };
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
  status: string,
  row?: NurseQueueRow
): "amber" | "destructive" | "secondary" | "outline" | "success" {
  if (isEndorsed(type, status)) return "success";
  if (status === "pending") return "amber";
  if (status === "escalated") return "destructive";
  // Withdrawals read neutral — red is reserved for desk rejections.
  if (status === "dismissed") return row && isWithdrawn(row) ? "outline" : "destructive";
  if (status === "resolved") return "secondary";
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

/* A dismissal the filing teacher made themselves (withdrawal) reads
   "Cancelled"; a desk decision reads "Reject". The backend resolves the
   actor from the dismissal audit trail. */
export function isWithdrawn(row: NurseQueueRow): boolean {
  return (
    row.status === "dismissed" &&
    (row.dismissedByRole === "adviser" || row.dismissedByRole === "subject_teacher")
  );
}

/* Watermark label for the diagonal background on each referral entry.
   Matches the sidebar action menu labels so the reader sees the
   same wording in the watermark as in the filters. */
export function watermarkLabel(row: NurseQueueRow): string {
  if (isEndorsed(row.type, row.status)) return "Endorse";
  if (isWithdrawn(row)) return "Cancelled";
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
  if (isWithdrawn(row)) return "cancelled";
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
