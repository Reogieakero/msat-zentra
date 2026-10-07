// Pure display helpers for the ADM Coordinator desk: enum labels, friendly
// audit text, status derivation, Manila date/time, meeting readouts. No API
// calls, no hooks — safe to import from any component.
import type {
  AdmCaseRow,
  AdmEligibility,
  AdmMeetingInvitee,
  LatestActionFallback,
  MeetingAttendee,
  MeetingAttendeeRole,
} from "./coordinator.types";

export const CONSULT_REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};

export function consultReviewerLabel(value: string | null | undefined): string {
  if (!value) return "Direct referral";
  return CONSULT_REVIEWER_LABELS[value] ?? friendlyWords(value);
}

/* Plain-words fallback for any snake_case enum that reaches the UI —
   never show raw values like "guidance_counselor" to users. */
export function friendlyWords(value: string): string {
  const words = value.replace(/_/g, " ").trim();
  if (!words) return value;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* Friendly audit action labels for the case history timeline. Falls back
   to plain words so raw action types never leak into the UI. */
const HISTORY_ACTION_LABELS: Record<string, string> = {
  anecdotal_edit: "Anecdotal record",
  referral_status_change: "Referral update",
  referral_adm_initiated: "Forwarded to ADM",
  referral_accepted: "Referral accepted",
  referral_escalated: "Referral escalated",
  referral_reassigned: "Referral reassigned",
  referral_note_added: "Referral note",
  referral_follow_up: "Referral follow-up",
  referral_dismissed: "Referral dismissed",
  referral_referred_specialist: "Referred to specialist",
  adm_edit: "ADM update",
  intervention_approval: "Intervention approval",
  account_approval: "Account approval",
};

export function friendlyActionType(actionType: string): string {
  return HISTORY_ACTION_LABELS[actionType] ?? friendlyWords(actionType);
}

const ROLE_TOKEN_LABELS: Record<string, string> = {
  adm_coordinator: "ADM Coordinator",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  principal: "Principal",
  adviser: "Adviser",
  subject_teacher: "Subject Teacher",
  registrar: "Registrar",
  record_keeper: "Record Keeper",
  lrpc: "LRPC",
};

/* Plain-words audit reasons for the case history timeline. The stored
   audit text uses backend vocabulary ("Referred to adm_coordinator",
   "ADM stage advanced to meeting_parents") — this rewrites the known
   patterns so users read natural language instead. */
export function friendlyReason(reason: string | null, actionType: string): string {
  if (!reason) return friendlyActionType(actionType);
  // "Referred to adm_coordinator (consult reviewer: guidance_counselor)"
  // → "Anecdotal referred for the ADM case — Guidance Counselor review"
  const referred = reason.match(/^Referred to (\S+?)(?: \(consult reviewer: ([^)]+)\))?$/);
  if (referred) {
    const target = referred[1];
    const reviewer = referred[2];
    const base =
      target === "adm_coordinator"
        ? "Anecdotal referred for the ADM case"
        : `Anecdotal referred to ${ROLE_TOKEN_LABELS[target] ?? friendlyWords(target)}`;
    return reviewer
      ? `${base} — ${CONSULT_REVIEWER_LABELS[reviewer] ?? friendlyWords(reviewer)} review`
      : base;
  }
  // "ADM stage advanced to meeting_parents" → friendly stage name
  const advanced = reason.match(/^ADM stage advanced to (\w+)$/);
  if (advanced) return `ADM stage advanced to ${stageLabel(advanced[1])}`;
  // Generic fallback: swap any leftover role tokens for proper names.
  let text = reason;
  for (const [token, label] of Object.entries(ROLE_TOKEN_LABELS)) {
    text = text.split(token).join(label);
  }
  return text;
}

export function deriveAdmCaseStatus(
  stage: string,
  eligibility: AdmEligibility,
  approvedBy: string | null,
  referralStatus?: string | null,
) {
  if (referralStatus === "dismissed") {
    return { key: "cancelled", label: "Cancelled" };
  }
  if (referralStatus === "resolved") {
    return { key: "resolved_case", label: "Resolved" };
  }
  switch (stage) {
    case "consultation":
      return { key: "need_review", label: "Need review by ADM" };
    case "meeting_parents":
      return { key: "parent_meeting", label: "Parent meeting" };
    case "home_visitation":
      return { key: "home_visit", label: "Home visitation" };
    case "certification":
      return eligibility === "eligible"
        ? { key: "ready_to_endorse", label: "Ready to endorse" }
        : { key: "for_certification", label: "For certification" };
    case "principal_approval":
      if (approvedBy) return { key: "endorsed", label: "Endorsed" };
      return eligibility === "eligible"
        ? { key: "endorsed", label: "Endorsed to Principal" }
        : { key: "needs_revision", label: "Needs revision" };
    case "enrollment_monitoring":
      return { key: "monitoring", label: "Monitoring" };
    case "completion":
      return { key: "completed", label: "Completed" };
    default:
      return { key: "filed", label: "Anecdotal filed" };
  }
}

export function admCaseStatusVariant(
  key: string,
): "amber" | "default" | "secondary" | "outline" | "destructive" | "success" | "red" {
  switch (key) {
    case "cancelled":
      return "red";
    case "resolved_case":
      return "success";
    case "need_review":
    case "for_certification":
      return "amber";
    case "ready_to_endorse":
    case "endorsed":
      return "default";
    case "needs_revision":
      return "destructive";
    case "parent_meeting":
    case "home_visit":
      return "secondary";
    case "monitoring":
    case "completed":
      return "success";
    default:
      return "outline";
  }
}

export const STAGE_LABELS: Record<string, string> = {
  anecdotal: "Anecdotal record filed",
  consultation: "Consultation & referral",
  meeting_parents: "Meeting with parents",
  home_visitation: "Home visitation",
  certification: "Recommendation & certification",
  principal_approval: "Principal approval",
  enrollment_monitoring: "Enrollment monitoring",
  completion: "Completion",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function eligibilityLabel(e: AdmEligibility): string {
  return e === "eligible" ? "Eligible" : e === "ineligible" ? "Ineligible" : "For Review";
}

function parseActionTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/* Latest-action fallback — guarantees the Latest action column reads the
   most recent known event for EVERY row, whatever the status (approved,
   cancelled, resolved, anything). Audit data wins whenever present —
   callers check lastActionType first and only call this when it is
   missing. Otherwise the latest timestamp among the row's own fields
   supplies a plain-words label (same status-only vocabulary as the
   timeline — never clinical detail). Null only when the row carries no
   usable timestamps at all, in which case the cell keeps "—". */
export function latestActionFallback(
  row: Pick<
    AdmCaseRow,
    "approvalDate" | "meeting" | "endorsedAt" | "datePrepared"
  >,
): LatestActionFallback | null {
  const candidates: { label: string; at: string; t: number }[] = [];
  const consider = (label: string, at: string | null | undefined) => {
    const t = parseActionTime(at);
    if (t === null || !at) return;
    candidates.push({ label, at, t });
  };
  consider("Principal approval", row.approvalDate);
  if (row.meeting) {
    consider(
      row.meeting.attended ? "Parent meeting attended" : "Parent meeting booked",
      row.meeting.datetime,
    );
  }
  consider("Referred for ADM", row.endorsedAt);
  consider("Case filed", row.datePrepared);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.t - a.t);
  const winner = candidates[0];
  return { label: winner.label, at: winner.at };
}

/* Referral-status badge variant — same vocabulary as the nurse/guidance
   alerts queues so every surface agrees. */
export function referralStatusVariant(
  status: string | undefined,
): "amber" | "default" | "secondary" | "outline" | "destructive" | "success" {
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

export const MEETING_INVITER_ROLE_LABELS: Record<string, string> = {
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adviser: "Adviser",
};

export function meetingInviteeLabel(u: Pick<AdmMeetingInvitee, "fullName" | "role">): string {
  const role = MEETING_INVITER_ROLE_LABELS[u.role] ?? friendlyWords(u.role);
  return `${u.fullName} · ${role}`;
}

export function venueLabel(venue: string): string {
  return venue === "home" ? "Home visit" : "In school";
}

/* Staff-login role → attendance role for invitee checklist entries. The
   attendance set has no plain "adviser", so section advisers (adviser or
   subject_teacher logins) file as teachers. */
const INVITEE_ATTENDEE_ROLES: Record<string, MeetingAttendeeRole> = {
  guidance_counselor: "guidance_counselor",
  nurse: "nurse",
  adviser: "teacher",
  subject_teacher: "teacher",
  principal: "principal",
  lrpc: "lrpc",
};

export function inviteeToAttendee(u: {
  id: string;
  fullName: string;
  role: string;
}): MeetingAttendee {
  return {
    name: u.fullName,
    role: INVITEE_ATTENDEE_ROLES[u.role] ?? "other",
    userId: u.id,
  };
}

export const MEETING_ATTENDEE_ROLE_LABELS: Record<MeetingAttendeeRole, string> = {
  parent_guardian: "Parent/Guardian",
  teacher: "Teacher",
  student: "Student",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  principal: "Principal",
  lrpc: "LRPC",
  other: "Other",
};

const ATTENDEE_ROLES = new Set<string>(
  Object.keys(MEETING_ATTENDEE_ROLE_LABELS),
);

/* Defensive parse — the column is schemaless JSON, so coerce anything
   unexpected into a clean list instead of crashing the card. */
export function parseMeetingAttendees(value: unknown): MeetingAttendee[] {
  if (!Array.isArray(value)) return [];
  const out: MeetingAttendee[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as { name?: unknown; role?: unknown; userId?: unknown };
    if (typeof raw.name !== "string" || !raw.name.trim()) continue;
    out.push({
      name: raw.name.trim().slice(0, 100),
      role: (typeof raw.role === "string" && ATTENDEE_ROLES.has(raw.role)
        ? raw.role
        : "other") as MeetingAttendeeRole,
      ...(typeof raw.userId === "string" && raw.userId
        ? { userId: raw.userId }
        : {}),
    });
    if (out.length >= 20) break;
  }
  return out;
}

export function attendeeLabel(a: MeetingAttendee): string {
  return `${a.name} · ${MEETING_ATTENDEE_ROLE_LABELS[a.role]}`;
}

/* System-generated attendance logbook ref — a numeric code, stable per
   meeting: <Manila YYYYMMDD>-<4 digits hashed from the meeting id>,
   e.g. 20260924-4821. Deterministic so reopening the dialog never mints
   a duplicate. */
export function generateLogbookRef(
  meetingDatetime: string,
  meetingId: string,
): string {
  const date = formatManilaDate(meetingDatetime).replace(/\D/g, "") || "00000000";
  const clean = meetingId.replace(/[^a-z0-9]/gi, "") || "0";
  let hash = 0;
  for (const ch of clean) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return `${date}-${`${hash}`.padStart(4, "0").slice(-4)}`;
}

/* Meeting readouts in Philippine time. Bookings are stored as UTC ISO
   strings, so slicing the raw string shows the UTC hour (e.g. an 8am
   Manila booking renders as the small hours). Always format through
   Asia/Manila — the same zone the backend uses for official forms. */
const MANILA_TZ = "Asia/Manila";

export function formatManilaDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/* Formal long date for display ("Sep 29, 2026") — sheet lines, table date
   cells, and details facts. Falls back to the raw YYYY-MM-DD slice. */
export function formatManilaDateLong(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatManilaTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/* "Parent meeting — Booked on 2026-09-25 at 08:00 AM · In school" — the
   full hover readout: meeting type + status + Manila schedule + venue. */
export function meetingTooltip(
  meeting: { datetime: string; venue: string; attended: boolean },
): string {
  const status = meeting.attended ? "Attended" : "Booked";
  return `Parent meeting — ${status} on ${formatManilaDate(meeting.datetime)} at ${formatManilaTime(meeting.datetime)} · ${venueLabel(meeting.venue)}`;
}

const ENDORSED_PREFIX = "[ADM endorsed]";
const CONSULT_PREFIX = "[ADM consult]";
const FORM_PART_KEYS = ["Concerns:", "Details:", "Actions taken:", "Follow-up:"];

/* Endorsement recommendation filed by the desk that sent the case to the
   ADM coordinator (nurse or guidance counselor). Prefers the latest
   `[ADM endorsed] <recommendation> | <form parts>` line, falling back to
   the legacy `[ADM consult] <recommendation>` line. Null when the case
   came straight from the adviser with no consultation review. */
export function endorsementRecommendation(
  notes: string | null | undefined,
): string | null {
  if (!notes) return null;
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const endorsed = [...lines]
    .reverse()
    .find((l) => l.startsWith(ENDORSED_PREFIX));
  if (endorsed) {
    const body = endorsed.slice(ENDORSED_PREFIX.length).trim();
    // The recommendation leads; the GCForm-03 answers follow as
    // " | "-joined parts starting at a known keyword. A recommendation
    // containing " | " rejoins, so only cut at a keyword boundary.
    const segments = body.split(" | ").map((s) => s.trim());
    const kept: string[] = [];
    for (const seg of segments) {
      if (FORM_PART_KEYS.some((k) => seg.startsWith(k))) break;
      if (seg) kept.push(seg);
    }
    const text = kept.join(" | ").trim();
    return text || null;
  }
  const consult = [...lines]
    .reverse()
    .find((l) => l.startsWith(CONSULT_PREFIX));
  if (!consult) return null;
  const text = consult.slice(CONSULT_PREFIX.length).trim();
  return text || null;
}
