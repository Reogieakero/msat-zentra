import type { AdmTrackStageKey } from "./adm-track-data";
import { actorActionLabel } from "@/lib/notifications/action-label";

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
  actor: string | null;
  text: string;
  detail?: string | null;
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

export function actorLabel(
  byRole: string | null | undefined,
  reader: "teacher" | "coordinator" = "teacher",
): string | null {
  if (!byRole) return null;
  if (byRole === "adviser" || byRole === "subject_teacher") {
    return reader === "coordinator" ? "Adviser" : "You";
  }
  return ROLE_LABELS[byRole] ?? "Staff";
}

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

function entryLine(
  entry: StageTimelineEntry,
  reader: "teacher" | "coordinator" = "teacher",
): StageActionLine {
  const label = actorActionLabel({
    scope: "teacher",
    action: entry.action,
    byRole: entry.byRole,
    cancelledByRole: entry.action === "session_cancelled" ? (entry.byRole ?? null) : undefined,
    message: entry.label,
    fallback: entry.label,
  });
  return {
    actor: actorLabel(entry.byRole, reader),
    text: label,
    detail: entry.detail ?? null,
    at: entry.at || null,
  };
}

export function latestActionByStage(
  input: TrackerCaseInput,
  reader: "teacher" | "coordinator" = "teacher",
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
    out[stage] = entryLine(latest, reader);
  }

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
