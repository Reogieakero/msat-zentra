import type { AdmTrackStageKey } from "./adm-track-data";
import { actorActionLabel } from "@/lib/notifications/action-label";

/* Per-stage latest actions for the adviser tracking surfaces (adm-cases
   rail + referrals track dialog share this, so both pages tell the same
   story). Every audit/session/meeting event maps to exactly one of the 8
   pipeline stages; row evidence (meetings, modules, devices, approval)
   fills stages the audit trail never touches. */

// Raw timeline entry shape from referrals/mine + adm/my-cases (additive
// fields over the legacy {label, detail, date} the dialogs already render).
export interface StageTimelineEntry {
  label: string;
  detail?: string | null;
  date: string;
  at: string;
  action: string;
  byRole: string | null;
  source: "referrals" | "counseling_sessions" | "adm_parent_meetings" | "case";
  stage?: string | null;
  homeVisit?: boolean;
}

// Everything the tracker needs, normalized from either teacher endpoint
// (AdmCase from adm/my-cases, TrackableReferral from referrals/mine).
export interface TrackerCaseInput {
  stage?: string | null;
  referralStatus?: string | null;
  consultReviewer?: string | null;
  referredBy?: string | null;
  anecdotalDate?: string | null;
  referredDate?: string | null;
  meetingAttended?: boolean | null;
  hasHomeVisit?: boolean;
  approved?: boolean;
  approvedAt?: string | null;
  modulesSubmitted?: number;
  modulesTotal?: number;
  lastModuleAt?: string | null;
  devicesReturned?: number;
  certificationIssued?: boolean;
  certificationAt?: string | null;
  lastMeetingAt?: string | null;
  resolvedAt?: string | null;
  timeline?: StageTimelineEntry[];
}

export interface StageActionLine {
  /** Who acted ("You" for the reader's own filings, desk names otherwise). */
  actor: string | null;
  text: string;
  detail?: string | null;
  /** Full ISO, or null when the fact has no timestamp. */
  at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  adviser: "You",
  subject_teacher: "You",
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

export function actorLabel(byRole: string | null | undefined): string | null {
  if (!byRole) return null;
  return ROLE_LABELS[byRole] ?? "Staff";
}

/* Which pipeline stage an audit entry belongs to. Referral lifecycle +
   sessions resolve at consultation (decisions and pre-confirm bookings
   happen there); meetings split by venue/miss onto the meeting vs
   home-visit path; synthesized entries carry their stage outright. */
export function stageForEntry(entry: Pick<StageTimelineEntry, "action" | "source" | "stage" | "homeVisit" | "label">): AdmTrackStageKey | null {
  if (entry.action === "adm_stage") {
    const key = (entry.stage ?? "") as AdmTrackStageKey;
    return (
      [
        "anecdotal",
        "consultation",
        "meeting_parents",
        "home_visitation",
        "certification",
        "principal_approval",
        "enrollment_monitoring",
        "completion",
      ] as string[]
    ).includes(key)
      ? key
      : "meeting_parents";
  }
  if (entry.action === "adm_approved") return "principal_approval";
  if (entry.source === "adm_parent_meetings") {
    return entry.homeVisit ? "home_visitation" : "meeting_parents";
  }
  if (entry.source === "counseling_sessions") return "consultation";
  if (entry.action === "referral_status_change") {
    if (/resolved|closed/i.test(entry.label)) return "completion";
    return "consultation";
  }
  if (entry.action.startsWith("referral_")) return "consultation";
  return null;
}

function entryLine(entry: StageTimelineEntry): StageActionLine {
  // Same actor-first wording as the desk alerts timelines ("Cancelled by
  // adviser", "Session booked by School Nurse", ...) — the reader here is
  // the filing teacher, so the mapper's teacher scope applies. Unknown
  // actions keep their friendly sentence with the actor prefix when known.
  const label = actorActionLabel({
    scope: "teacher",
    action: entry.action,
    byRole: entry.byRole,
    cancelledByRole: entry.action === "session_cancelled" ? (entry.byRole ?? null) : undefined,
    message: entry.label,
    fallback: entry.label,
  });
  return {
    actor: actorLabel(entry.byRole),
    text: label,
    detail: entry.detail ?? null,
    at: entry.at || null,
  };
}

/* Latest action per stage: newest audit-mapped entry wins; row evidence
   fills stages the audit trail never touches (meetings, home visits,
   certification, approvals, modules, closure). Null = static detail line. */
export function latestActionByStage(
  input: TrackerCaseInput
): Record<AdmTrackStageKey, StageActionLine | null> {
  const out: Record<AdmTrackStageKey, StageActionLine | null> = {
    anecdotal: null,
    consultation: null,
    meeting_parents: null,
    home_visitation: null,
    certification: null,
    principal_approval: null,
    enrollment_monitoring: null,
    completion: null,
  };

  const entries = (input.timeline ?? []).filter((e) => e && e.at);
  const byStage = new Map<AdmTrackStageKey, StageTimelineEntry[]>();
  for (const e of entries) {
    const stage = stageForEntry(e);
    if (!stage) continue;
    const list = byStage.get(stage) ?? [];
    list.push(e);
    byStage.set(stage, list);
  }
  for (const [stage, list] of byStage) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const latest = list[list.length - 1];
    out[stage] = entryLine(latest);
  }

  // Row-evidence fallbacks (actor implied by route guards that wrote them).
  if (!out.meeting_parents && input.meetingAttended !== null && input.meetingAttended !== undefined) {
    out.meeting_parents = {
      actor: "ADM Coordinator",
      text: input.meetingAttended ? "Parents attended the meeting." : "Parent meeting booked.",
      at: input.lastMeetingAt ?? null,
    };
  }
  if (!out.home_visitation && input.hasHomeVisit) {
    out.home_visitation = {
      actor: "Guidance Counselor",
      text: "Home visit done.",
      at: null,
    };
  }
  if (!out.certification && input.certificationAt) {
    out.certification = {
      actor: "ADM Coordinator",
      text: "Certification issued.",
      at: input.certificationAt,
    };
  }
  if (!out.enrollment_monitoring && input.lastModuleAt) {
    out.enrollment_monitoring = {
      actor: "Student",
      text: `Modules ${input.modulesSubmitted ?? 0}/${input.modulesTotal ?? 0} submitted.`,
      at: input.lastModuleAt,
    };
  }
  if (!out.completion && input.resolvedAt) {
    out.completion = {
      actor: "ADM Coordinator",
      text: "Case closed.",
      at: input.resolvedAt,
    };
  }
  return out;
}

/* Reader-local full timestamp ("Oct 1, 2026 · 2:30 PM"), same clock for
   date and time — never UTC. Dependency-free (shared file). */
export function formatActionTime(value: string | null | undefined): string {
  if (!value || value === "—") return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatActionDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatActionDate(localDay)} · ${formatActionTimeOnly(value)}`;
}

export function formatActionDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

function formatActionTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
