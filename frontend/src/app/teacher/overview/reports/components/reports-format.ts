export function formatPercent(value: number | null, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatGrade(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates not set";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function termStatus(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (s <= now && now <= e) return "Ongoing";
  if (now < s) return "Upcoming";
  return "Ended";
}

export const LOCK_LABELS: Record<string, string> = {
  unlocked: "Unlocked",
  locked: "Locked",
  adviser_approved: "Adviser approved",
};

export const FLAG_LABELS: Record<string, string> = {
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
  escalated: "Escalated",
  info_requested: "Info requested",
  dismissed: "Dismissed",
  follow_up: "Follow-up",
};
