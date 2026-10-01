import type {
  CounselingSessionItem,
  GuidanceReferralItem,
  GuidanceReferralStatus,
  GuidanceReferralsSummary,
  GuidanceTypeSummary,
} from "./guidance-referrals-data";
import { actorActionLabel } from "@/lib/notifications/action-label";

/* Case type — which action track the referral needs: ADM-bound (moving
   toward the ADM coordinator) or regular guidance counseling. */
export type GuidanceTypeFilter = "" | "Counseling" | "ADM";

export const GUIDANCE_TYPES: { value: GuidanceTypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "Counseling", label: "Counseling" },
  { value: "ADM", label: "ADM" },
];

/* Sidebar action menus — same groups and labels as the nurse desk.
   Counseling mirrors the nurse Clinic menu; ADM mirrors the nurse ADM
   menu. Needs review = pending cases awaiting the review decision;
   Endorse = already endorsed to the ADM coordinator (confirmed, form
   filled — same as the nurse ADM referral follow). Each entry resolves
   to server filters. */
export type GuidanceAction =
  | ""
  | "counseling_needs"
  | "counseling_booked"
  | "counseling_done"
  | "counseling_followup"
  | "counseling_cancelled"
  | "adm_needs"
  | "endorse"
  | "adm_followup"
  | "adm_booked"
  | "adm_reject"
  | "adm_cancelled";

export type GuidanceActionValue = Exclude<GuidanceAction, "">;

export type GuidanceTrack = "Counseling" | "ADM";

const COUNSELING_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "counseling_needs", label: "Needs review" },
  { value: "counseling_booked", label: "Booked session" },
  { value: "counseling_done", label: "Done" },
  { value: "counseling_followup", label: "Follow-up" },
  { value: "counseling_cancelled", label: "Cancelled" },
];

const ADM_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "adm_followup", label: "Follow-up" },
  { value: "adm_booked", label: "Book session" },
  { value: "adm_reject", label: "Reject" },
  { value: "adm_cancelled", label: "Cancelled" },
];

export const COUNSELING_MENU = COUNSELING_ROWS;
export const ADM_MENU = ADM_ROWS;

export interface GuidanceActionParams {
  type: "" | "counseling" | "adm";
  status: "" | GuidanceReferralStatus;
  booked: boolean;
  completed: boolean;
  open: boolean;
  // Client-only: adviser/subject-teacher withdrawals (no server equivalent —
  // the server only filters by status). Honored by matchesGuidanceFilters on
  // the locked full-list pages; hidden in the unlocked All page menu.
  withdrawn: boolean;
}

/* One menu pick → the exact server filters (type + status + gates). */
export function resolveActionParams(action: GuidanceAction): GuidanceActionParams {
  switch (action) {
    case "counseling_needs":
      return { type: "counseling", status: "pending", booked: false, completed: false, open: false, withdrawn: false };
    case "counseling_booked":
      return { type: "counseling", status: "", booked: true, completed: false, open: false, withdrawn: false };
    case "counseling_done":
      return { type: "counseling", status: "", booked: false, completed: true, open: false, withdrawn: false };
    case "counseling_followup":
      return { type: "counseling", status: "follow_up", booked: false, completed: false, open: false, withdrawn: false };
    case "counseling_cancelled":
      return { type: "counseling", status: "dismissed", booked: false, completed: false, open: false, withdrawn: true };
    case "adm_needs":
      return { type: "adm", status: "pending", booked: false, completed: false, open: false, withdrawn: false };
    case "endorse":
      return { type: "adm", status: "in_progress", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_followup":
      return { type: "adm", status: "follow_up", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_booked":
      return { type: "adm", status: "", booked: true, completed: false, open: false, withdrawn: false };
    case "adm_reject":
      return { type: "adm", status: "dismissed", booked: false, completed: false, open: false, withdrawn: false };
    case "adm_cancelled":
      return { type: "adm", status: "dismissed", booked: false, completed: false, open: false, withdrawn: true };
    default:
      return { type: "", status: "", booked: false, completed: false, open: false, withdrawn: false };
  }
}

export function trackMenuCounts(
  summary: GuidanceReferralsSummary | null,
  track: GuidanceTrack
): Record<GuidanceActionValue, number> {
  const scoped = summary?.byType?.[track];
  const zero: Record<GuidanceActionValue, number> = {
    counseling_needs: 0,
    counseling_booked: 0,
    counseling_done: 0,
    counseling_followup: 0,
    counseling_cancelled: 0,
    adm_needs: 0,
    endorse: 0,
    adm_followup: 0,
    adm_booked: 0,
    adm_reject: 0,
    adm_cancelled: 0,
  };
  if (!scoped) return zero;
  // Reject counts desk decisions only — withdrawals split out into
  // Cancelled so no case is ever counted twice.
  const cancelled = scoped.cancelled ?? 0;
  return {
    counseling_needs: track === "Counseling" ? scoped.pending : 0,
    counseling_booked: track === "Counseling" ? scoped.booked : 0,
    counseling_done: track === "Counseling" ? scoped.done : 0,
    counseling_followup: track === "Counseling" ? scoped.followUp : 0,
    counseling_cancelled: track === "Counseling" ? cancelled : 0,
    adm_needs: track === "ADM" ? scoped.pending : 0,
    endorse: track === "ADM" ? scoped.inProgress : 0,
    adm_followup: track === "ADM" ? scoped.followUp : 0,
    adm_booked: track === "ADM" ? scoped.booked : 0,
    adm_reject: track === "ADM" ? Math.max(0, scoped.dismissed - cancelled) : 0,
    adm_cancelled: track === "ADM" ? cancelled : 0,
  };
}

export function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ANECDOTAL_CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

/* Folder body color per anecdotal category — same map as the nurse desk
   so report folders match across timelines. */
export function anecdotalCategoryColor(category: string | null | undefined): string | undefined {
  if (!category) return undefined;
  return ANECDOTAL_CATEGORY_COLORS[category.trim().toLowerCase()];
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
      return "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    case "info_requested":
      return "Needs more info";
    default:
      return formatStatus(status);
  }
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
      return "This was sent to a higher office.";
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

/* Watermark color class suffix for each status — maps to CSS
   classes that give each status its own distinct color. */
export function watermarkColor(row: GuidanceReferralItem): string {
  if (isEndorsed(row.type, row.status)) return "endorse";
  if (isWithdrawn(row)) return "cancelled";
  if (row.status === "dismissed") return "reject";
  if (row.status === "resolved") return "done";
  if (row.status === "follow_up") return "followup";
  if (hasScheduledSession(row.sessions)) return "booked";
  if (row.status === "pending") return "needsreview";
  return "";
}

/* An ADM case in progress is an endorsed case — same rule as the nurse
   desk: the review is done and the case now sits with the ADM
   coordinator. The left rail must read "Endorsed", never "In progress",
   so both desks say the same thing for the same state. */
export function isEndorsed(type: string, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

/* Badge text for one row — endorsed ADM cases read "Endorsed", never "In
   progress", matching the nurse desk. Withdrawn cases read "Cancelled"
   (pass the row); desk decisions read "Closed". */
export function rowStatusLabel(type: string, status: string, row?: GuidanceReferralItem): string {
  if (isEndorsed(type, status)) return "Endorsed";
  if (row && isWithdrawn(row)) return "Cancelled";
  return statusLabel(status);
}

export function rowStatusHelp(type: string, status: string, row?: GuidanceReferralItem): string {
  if (isEndorsed(type, status)) return "Endorsed — now with the ADM coordinator.";
  if (row && isWithdrawn(row)) return "Withdrawn by the filing teacher — no further action.";
  return statusHelp(status);
}

export function roleLabel(value: string): string {
  switch (value) {
    case "principal":
      return "Principal";
    case "nurse":
      return "Nurse";
    case "adm_coordinator":
      return "ADM coordinator";
    case "guidance_counselor":
      return "Guidance";
    default:
      return formatStatus(value);
  }
}

/* Friendly names for the four session kinds. */
export function sessionTypeLabel(value: string): string {
  switch (value) {
    case "individual":
      return "One-on-one";
    case "parent_conference":
      return "Parent conference";
    case "group":
      return "Group session";
    case "home_visit":
      return "Home visit";
    default:
      return formatStatus(value);
  }
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

/* "2026-09-20T06:30:00.000Z" -> "Sep 20, 2026 · 2:30 PM" (reader's timezone). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

/* Backend audit type -> plain label for the left-rail latest action.
   Labels match the nurse desk for the same events ("Cancelled" for a
   filing-teacher withdrawal, "Rejected" for a desk dismissal,
   "Endorsed to ADM coordinator" for an endorsed ADM
   case) so both timelines read the same. */
function labelForActionType(actionType: string, row: GuidanceReferralItem): string {
  // Actor-first wording shared with every desk (see action-label.ts), so
  // both timelines read the same: "Cancelled by adviser",
  // "Session booked by Guidance Counselor", ...
  const fallback = statusLabel(row.status);
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
    case "referral_reassigned":
    case "referral_note_added":
    case "referral_referred_specialist":
    case "referral_adm_initiated":
      return actorActionLabel({ scope: "guidance", action: actionType, fallback });
    case "session_cancelled":
      return actorActionLabel({
        scope: "guidance",
        action: actionType,
        cancelledByRole: newestSession?.cancelledByRole ?? null,
        fallback,
      });
    case "referral_dismissed":
      return actorActionLabel({
        scope: "guidance",
        action: actionType,
        withdrawn: isWithdrawn(row),
        fallback,
      });
    case "referral_escalated":
      return "Sent to a higher office by Guidance Counselor";
    case "referral_status_change":
      if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator by Guidance Counselor";
      if (row.status === "follow_up") return "Marked for follow-up by Guidance Counselor";
      if (row.status === "resolved") return "Resolved by Guidance Counselor";
      if (row.status === "dismissed")
        return actorActionLabel({
          scope: "guidance",
          action: "referral_dismissed",
          withdrawn: isWithdrawn(row),
          fallback,
        });
      if (row.status === "escalated") return "Sent to a higher office by Guidance Counselor";
      if (row.status === "in_progress") return "Accepted by Guidance Counselor";
      return fallback;
    default:
      return fallback;
  }
}

/* Latest action on the case for the left rail, with its EXECUTION time.
   Prefers the backend audit time (when the action ran); never shows the
   future appointment time as the action time. */
export function latestActionOf(row: GuidanceReferralItem): { label: string; time: string } {
  if (row.lastActionAt) {
    return { label: labelForActionType(row.lastActionType, row), time: row.lastActionAt };
  }
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
    if (latest.status === "completed") {
      return {
        label: actorActionLabel({ scope: "guidance", action: "session_completed", fallback: "Session done" }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    if (latest.status === "cancelled") {
      return {
        label: actorActionLabel({
          scope: "guidance",
          action: "session_cancelled",
          cancelledByRole: latest.cancelledByRole ?? null,
          fallback: "Session cancelled",
        }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    return {
      label: actorActionLabel({ scope: "guidance", action: "session_scheduled", fallback: "Session booked" }),
      time: latest.createdAt || latest.scheduledAt,
    };
  }
  if (row.followUpDate) return { label: "Marked for follow-up by Guidance Counselor", time: row.followUpDate };
  if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator by Guidance Counselor", time: row.date };
  if (row.status === "dismissed")
    return {
      label: actorActionLabel({
        scope: "guidance",
        action: "referral_dismissed",
        withdrawn: isWithdrawn(row),
        fallback: "Rejected",
      }),
      time: row.date,
    };
  if (row.status === "resolved") return { label: "Resolved by Guidance Counselor", time: row.date };
  if (row.status === "escalated") return { label: "Sent to a higher office by Guidance Counselor", time: row.date };
  return { label: statusLabel(row.status), time: row.date };
}

/* Full ISO -> "Sep 14, 2026 · 2:30 PM" in the reader's local timezone
   (date and time on the same clock) — never UTC. */
export function formatActionTime(value: string): string {
  if (!value || value === "—") return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatDate(localDay)} · ${formatTime(value)}`;
}

export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/* Shared by the accept + schedule dialogs — and the interventions page. */
export const SESSION_KIND_OPTIONS = [
  { value: "individual", label: "One-on-one" },
  { value: "parent_conference", label: "Parent conference" },
  { value: "group", label: "Group session" },
  { value: "home_visit", label: "Home visit" },
];

export function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function statusVariant(
  status: string,
  type?: string,
  row?: GuidanceReferralItem
): "warning" | "destructive" | "secondary" | "outline" | "success" {
  if (type !== undefined && isEndorsed(type, status)) return "success";
  if (status === "pending") return "warning";
  if (status === "escalated") return "destructive";
  // Rejected reads red everywhere, same as the nurse desk. Withdrawals
  // read neutral — red is reserved for desk rejections.
  if (status === "dismissed") return row && isWithdrawn(row) ? "outline" : "destructive";
  if (status === "resolved") return "secondary";
  return "outline";
}

export function activeSessionOf(sessions: CounselingSessionItem[]): CounselingSessionItem | null {
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

export function hasScheduledSession(sessions: CounselingSessionItem[]): boolean {
  return sessions.some((s) => s.status === "scheduled");
}

/* A dismissal the filing teacher made themselves (withdrawal) reads
   "Cancelled"; a desk decision reads "Reject". The backend resolves the
   actor from the dismissal audit trail. */
export function isWithdrawn(row: GuidanceReferralItem): boolean {
  return (
    row.status === "dismissed" &&
    (row.dismissedByRole === "adviser" || row.dismissedByRole === "subject_teacher")
  );
}

/* Watermark label for the diagonal background on each referral entry.
   Matches the sidebar action menu labels so the reader sees the
   same wording in the watermark as in the filters. */
export function watermarkLabel(row: GuidanceReferralItem): string {
  if (isEndorsed(row.type, row.status)) return "Endorse";
  if (isWithdrawn(row)) return "Cancelled";
  if (row.status === "dismissed") return "Reject";
  if (row.status === "resolved") return "Done";
  if (row.status === "follow_up") return "Follow-up";
  if (hasScheduledSession(row.sessions)) return "Booked session";
  if (row.status === "pending") return "Needs review";
  return rowStatusLabel(row.type, row.status);
}

/* Client-side equivalents of the server list filters (status/type gates,
   session gates, search fields) — same semantics as the endpoint, for the
   full-list locked pages. The menu counts below use the same rules. */
export function matchesGuidanceFilters(
  row: GuidanceReferralItem,
  q: string,
  params: GuidanceActionParams,
): boolean {
  if (params.status !== "" && row.status !== params.status) return false;
  if (params.type === "adm" && row.type !== "ADM") return false;
  if (params.type === "counseling" && row.type !== "Counseling") return false;
  if (params.booked && row.sessions.length === 0) return false;
  if (params.completed && !row.sessions.some((s) => s.status === "completed")) return false;
  if (params.open && (row.status === "resolved" || row.status === "dismissed")) return false;
  if (params.withdrawn && !isWithdrawn(row)) return false;
  // Reject picks (status dismissed, withdrawn false) exclude withdrawals —
  // both resolve to status dismissed, so the withdrawn flag splits them and
  // no case ever matches both filters.
  if (!params.withdrawn && params.status === "dismissed" && isWithdrawn(row)) return false;
  const needle = q.trim().toLowerCase();
  if (
    needle !== "" &&
    !`${row.student} ${row.lrn} ${row.section} ${row.referredBy} ${row.observer} ${row.reason} ${row.anecdotalExcerpt} ${row.category}`
      .toLowerCase()
      .includes(needle)
  )
    return false;
  return true;
}

/* Client-side menu-count summary over a full track list — same rules as
   the endpoint's byType totals, so the sidebar never disagrees. */
export function buildGuidanceSummary(
  rows: GuidanceReferralItem[],
): GuidanceReferralsSummary {
  const byType = (type: "Counseling" | "ADM"): GuidanceTypeSummary => {
    const scoped = rows.filter((r) => r.type === type);
    const open = scoped.filter((r) => r.status !== "resolved" && r.status !== "dismissed");
    return {
      pending: scoped.filter((r) => r.status === "pending").length,
      inProgress: scoped.filter((r) => r.status === "in_progress").length,
      followUp: scoped.filter((r) => r.status === "follow_up").length,
      escalated: scoped.filter((r) => r.status === "escalated").length,
      resolved: scoped.filter((r) => r.status === "resolved").length,
      dismissed: scoped.filter((r) => r.status === "dismissed").length,
      cancelled: scoped.filter((r) => isWithdrawn(r)).length,
      booked: scoped.filter((r) => r.sessions.length > 0).length,
      done: scoped.filter((r) => r.sessions.some((s) => s.status === "completed")).length,
      open: open.length,
    };
  };
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    escalated: rows.filter((r) => r.status === "escalated").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
    followUp: rows.filter((r) => r.status === "follow_up").length,
    byType: { Counseling: byType("Counseling"), ADM: byType("ADM") },
  };
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
