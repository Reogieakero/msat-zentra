import type {
  CounselingSessionItem,
  GuidanceReferralItem,
  GuidanceReferralStatus,
  GuidanceReferralsSummary,
} from "./guidance-referrals-data";

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
  | "adm_needs"
  | "endorse"
  | "adm_followup"
  | "adm_booked"
  | "adm_reject";

export type GuidanceActionValue = Exclude<GuidanceAction, "">;

export type GuidanceTrack = "Counseling" | "ADM";

const COUNSELING_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "counseling_needs", label: "Needs review" },
  { value: "counseling_booked", label: "Booked session" },
  { value: "counseling_done", label: "Done" },
  { value: "counseling_followup", label: "Follow-up" },
];

const ADM_ROWS: { value: GuidanceActionValue; label: string }[] = [
  { value: "adm_needs", label: "Needs review" },
  { value: "endorse", label: "Endorse" },
  { value: "adm_followup", label: "Follow-up" },
  { value: "adm_booked", label: "Book session" },
  { value: "adm_reject", label: "Reject" },
];

export const COUNSELING_MENU = COUNSELING_ROWS;
export const ADM_MENU = ADM_ROWS;

export interface GuidanceActionParams {
  type: "" | "counseling" | "adm";
  status: "" | GuidanceReferralStatus;
  booked: boolean;
  completed: boolean;
  open: boolean;
}

/* One menu pick → the exact server filters (type + status + gates). */
export function resolveActionParams(action: GuidanceAction): GuidanceActionParams {
  switch (action) {
    case "counseling_needs":
      return { type: "counseling", status: "pending", booked: false, completed: false, open: false };
    case "counseling_booked":
      return { type: "counseling", status: "", booked: true, completed: false, open: false };
    case "counseling_done":
      return { type: "counseling", status: "", booked: false, completed: true, open: false };
    case "counseling_followup":
      return { type: "counseling", status: "follow_up", booked: false, completed: false, open: false };
    case "adm_needs":
      return { type: "adm", status: "pending", booked: false, completed: false, open: false };
    case "endorse":
      return { type: "adm", status: "in_progress", booked: false, completed: false, open: false };
    case "adm_followup":
      return { type: "adm", status: "follow_up", booked: false, completed: false, open: false };
    case "adm_booked":
      return { type: "adm", status: "", booked: true, completed: false, open: false };
    case "adm_reject":
      return { type: "adm", status: "dismissed", booked: false, completed: false, open: false };
    default:
      return { type: "", status: "", booked: false, completed: false, open: false };
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
    adm_needs: 0,
    endorse: 0,
    adm_followup: 0,
    adm_booked: 0,
    adm_reject: 0,
  };
  if (!scoped) return zero;
  return {
    counseling_needs: track === "Counseling" ? scoped.pending : 0,
    counseling_booked: track === "Counseling" ? scoped.booked : 0,
    counseling_done: track === "Counseling" ? scoped.done : 0,
    counseling_followup: track === "Counseling" ? scoped.followUp : 0,
    adm_needs: track === "ADM" ? scoped.pending : 0,
    endorse: track === "ADM" ? scoped.inProgress : 0,
    adm_followup: track === "ADM" ? scoped.followUp : 0,
    adm_booked: track === "ADM" ? scoped.booked : 0,
    adm_reject: track === "ADM" ? scoped.dismissed : 0,
  };
}

export function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
   progress", matching the nurse desk. */
export function rowStatusLabel(type: string, status: string): string {
  if (isEndorsed(type, status)) return "Endorsed";
  return statusLabel(status);
}

export function rowStatusHelp(type: string, status: string): string {
  if (isEndorsed(type, status)) return "Endorsed — now with the ADM coordinator.";
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
   Labels match the nurse desk for the same events ("Rejected" for a
   dismissed case, "Endorsed to ADM coordinator" for an endorsed ADM
   case) so both timelines read the same. */
function labelForActionType(actionType: string, row: GuidanceReferralItem): string {
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
      return "Sent to a higher office";
    case "referral_reassigned":
      return "Passed to someone else";
    case "referral_note_added":
      return "Note added";
    case "referral_referred_specialist":
      return "Specialist asked";
    case "referral_adm_initiated":
      return "ADM process started";
    case "referral_status_change":
      if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator";
      if (row.status === "follow_up") return "Marked for follow-up";
      if (row.status === "resolved") return "Resolved";
      if (row.status === "dismissed") return "Rejected";
      if (row.status === "escalated") return "Sent to a higher office";
      if (row.status === "in_progress") return "Accepted — handling";
      return statusLabel(row.status);
    default:
      return statusLabel(row.status);
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
      return { label: "Session done", time: latest.createdAt || latest.scheduledAt };
    }
    if (latest.status === "cancelled") {
      return { label: "Session cancelled", time: latest.createdAt || latest.scheduledAt };
    }
    return { label: "Session booked", time: latest.createdAt || latest.scheduledAt };
  }
  if (row.followUpDate) return { label: "Marked for follow-up", time: row.followUpDate };
  if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator", time: row.date };
  if (row.status === "dismissed") return { label: "Rejected", time: row.date };
  if (row.status === "resolved") return { label: "Resolved", time: row.date };
  if (row.status === "escalated") return { label: "Sent to a higher office", time: row.date };
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
  type?: string
): "warning" | "destructive" | "secondary" | "outline" | "success" {
  if (type !== undefined && isEndorsed(type, status)) return "success";
  if (status === "pending") return "warning";
  if (status === "escalated") return "destructive";
  if (status === "resolved" || status === "dismissed") return "secondary";
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

/* Watermark label for the diagonal background on each referral entry.
   Matches the sidebar action menu labels so the reader sees the
   same wording in the watermark as in the filters. */
export function watermarkLabel(row: GuidanceReferralItem): string {
  if (isEndorsed(row.type, row.status)) return "Endorse";
  if (row.status === "dismissed") return "Reject";
  if (row.status === "resolved") return "Done";
  if (row.status === "follow_up") return "Follow-up";
  if (hasScheduledSession(row.sessions)) return "Booked session";
  if (row.status === "pending") return "Needs review";
  return rowStatusLabel(row.type, row.status);
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
