import { isEndorsed, isWithdrawn } from "./referral-status";
export function buildTypeOptions(tracks: string[]): { value: string; label: string }[] {
  return [{ value: "", label: "All types" }, ...tracks.map((t) => ({ value: t, label: t }))];
}
export function buildActionMenu<V extends string>(rows: { value: V; label: string }[]): { value: V; label: string }[] {
  return rows;
}
export function matchesActionFilter(
  row: { type: string; status: string; sessions: { status?: string | null }[]; dismissedByRole?: string | null },
  filter: string,
  opts?: { track?: string; prefix?: string }
): boolean {
  if (opts?.track && row.type !== opts.track) {
    if (
      (filter === "adm_needs" ||
        filter === "endorse" ||
        filter === "followup" ||
        filter === "booked" ||
        filter === "reject" ||
        filter === "adm_cancelled") &&
      opts.track !== "ADM"
    ) {
      return false;
    }
    if (
      (filter === "clinic_needs" ||
        filter === "clinic_booked" ||
        filter === "clinic_done" ||
        filter === "clinic_followup" ||
        filter === "clinic_cancelled") &&
      opts.track !== "Clinic"
    ) {
      return false;
    }
  }
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
export function matchesGuidanceFilters(
  row: {
    type: string;
    status: string;
    sessions: { status?: string | null }[];
    dismissedByRole?: string | null;
    student: string;
    lrn: string;
    section: string;
    referredBy: string;
    observer: string;
    reason: string;
    anecdotalExcerpt: string;
    category: string;
  },
  q: string,
  params: { status: string; type: string; booked: boolean; completed: boolean; open: boolean; withdrawn: boolean },
  opts?: { track?: string; prefix?: string }
): boolean {
  void opts;
  if (params.status !== "" && row.status !== params.status) return false;
  if (params.type === "adm" && row.type !== "ADM") return false;
  if (params.type === "counseling" && row.type !== "Counseling") return false;
  if (params.booked && row.sessions.length === 0) return false;
  if (params.completed && !row.sessions.some((s) => s.status === "completed")) return false;
  if (params.open && (row.status === "resolved" || row.status === "dismissed")) return false;
  if (params.withdrawn && !isWithdrawn(row)) return false;
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
export function trackMenuCounts(
  summary: {
    byType?: Record<string, { pending: number; inProgress: number; followUp: number; booked: number; done: number; dismissed: number; cancelled?: number }>;
  } | null,
  track: string,
  opts?: { prefix?: string }
): Record<string, number> {
  void opts;
  const scoped = summary?.byType?.[track];
  const zero: Record<string, number> = {
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
