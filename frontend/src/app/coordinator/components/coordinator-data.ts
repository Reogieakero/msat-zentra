import * as React from "react";
import { apiClient } from "@/lib/api/client";

export type AdmEligibility = "pending" | "eligible" | "ineligible";

export type AdmStage =
  | "anecdotal"
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export interface AdmFormRef {
  id: string;
  formType: string;
  title: string;
  status: string;
}

export interface AdmCaseRow {
  id: string;
  lrn: string;
  student: string;
  grade: string;
  stage: AdmStage | string;
  eligibilityStatus: AdmEligibility;
  preparedBy: string;
  datePrepared: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  forms: AdmFormRef[];
  studentId?: string;
  /* Latest parent/guardian meeting (from /referrals/all) — null when no
     meeting booked yet or the row is an early referral without a profile. */
  meeting?: {
    id: string;
    datetime: string;
    venue: string;
    attended: boolean;
  } | null;
  /* Guidance/nurse hand-off timestamp (full ISO) on early referral rows —
     the moment the referral to the ADM Coordinator was created. Waiting-time
     readouts run from here, not from the anecdotal observation date. */
  endorsedAt?: string | null;
  /** Consultation reviewer on early referral rows (nurse | guidance_counselor | lrpc | null when direct). */
  consultReviewer?: string | null;
  /** Referral-level status on early referral rows (pending | in_progress | …). */
  referralStatus?: string;
}

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

/* Action-derived ADM case status — what the case actually needs now,
   computed from the backend pipeline (ADM_STAGE_FLOW in
   backend/src/services/adm.ts) instead of showing the raw stage enum.
   Same idea as the nurse queue's deriveActionStatus. */
export interface AdmCaseStatus {
  key: string;
  label: string;
}

export function deriveAdmCaseStatus(
  stage: string,
  eligibility: AdmEligibility,
  approvedBy: string | null,
): AdmCaseStatus {
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
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  switch (key) {
    case "need_review":
    case "for_certification":
      return "warning";
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

export interface AdmDashboard {
  kpis: { pendingSignature: number; signed: number; active: number };
  stageBreakdown: { stage: string; short: string; count: number }[];
  latestReferred: AdmCaseRow[];
  /** Headline totals served with the dashboard so the overview page does not
      need extra round-trips. Optional for backward compatibility. */
  totalReferred?: number;
  needsRevision?: number;
  deviceSummary?: { issued: number; returned: number };
}

export interface AdmReferralsPage {
  rows: AdmCaseRow[];
  total: number;
  totalReferred: number;
  stageCounts: Record<string, number>;
  page: number;
  totalPages: number;
  limit: number;
}

export interface AdmApprovalRow extends AdmCaseRow {
  section?: string;
}

export interface AdmApprovalsPage {
  rows: AdmApprovalRow[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface AdmDeviceRow {
  id: string;
  admLearnerProfileId: string;
  student: string;
  lrn: string;
  grade: string;
  stage: string;
  deviceType: string;
  deviceSerial: string;
  issuedBy: string;
  issuedDate: string;
  returnedDate: string | null;
  conditionNotes: string | null;
  status: "issued" | "returned";
}

export interface AdmDevicesPage {
  rows: AdmDeviceRow[];
  total: number;
  issued: number;
  returned: number;
  /** Present when the ledger was read with `page + limit` pagination. */
  page?: number;
  totalPages?: number;
  limit?: number;
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

export async function fetchCoordinatorDashboard(signal?: AbortSignal): Promise<AdmDashboard> {
  const res = await apiClient.get<AdmDashboard>("/api/adm/dashboard", { signal });
  return res.data;
}

export async function fetchCoordinatorReferrals(
  page: number,
  opts?: {
    q?: string;
    stage?: string;
    eligibility?: "all" | AdmEligibility;
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<AdmReferralsPage> {
  const res = await apiClient.get<AdmReferralsPage>("/api/adm/referrals/all", {
    params: {
      page,
      ...(opts?.limit && opts.limit > 0 ? { limit: opts.limit } : {}),
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
      ...(opts?.stage && opts.stage !== "all" ? { stage: opts.stage } : {}),
      ...(opts?.eligibility && opts.eligibility !== "all"
        ? { eligibility: opts.eligibility }
        : {}),
    },
    signal: opts?.signal,
  });
  return res.data;
}

export async function fetchCoordinatorApprovals(
  page = 1,
  opts?: { q?: string; limit?: number; signal?: AbortSignal },
): Promise<AdmApprovalsPage> {
  const res = await apiClient.get<AdmApprovalsPage>("/api/adm/approvals", {
    params: {
      page,
      ...(opts?.limit && opts.limit > 0 ? { limit: opts.limit } : {}),
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
    },
    signal: opts?.signal,
  });
  return res.data;
}

export async function fetchCoordinatorDevices(opts?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
  order?: "oldest" | "newest";
  signal?: AbortSignal;
}): Promise<AdmDevicesPage> {
  const res = await apiClient.get<AdmDevicesPage>("/api/adm/devices", {
    params: {
      ...(opts?.q?.trim() ? { q: opts.q.trim() } : {}),
      ...(opts?.status && opts.status !== "all" ? { status: opts.status } : {}),
      ...(opts?.page && opts.page > 1 ? { page: opts.page } : {}),
      ...(opts?.limit && opts.limit > 0 ? { limit: opts.limit } : {}),
      ...(opts?.order === "oldest" ? { order: "oldest" } : {}),
    },
    signal: opts?.signal,
  });
  return res.data;
}

export function apiErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const data = (err as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
    if (err instanceof Error) return err.message;
  }
  return "Something went wrong. Please try again.";
}

/* Live clock — ticks every 30s; elapsed readouts render days / hours /
   minutes only, so per-second ticks would just burn renders. Mirrors the
   nurse alerts queue. */
export function useNowTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* "4d 3h 12m" / "3h 12m" / "12m" / "just now" — days, hours, minutes only,
   never seconds. Mirrors the nurse alerts queue. */
export function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/* ms from a YYYY-MM-DD (or ISO) date to now. Null when unparseable — the
   cell then shows "—". */
export function msSinceDate(date: string | null, now: number): number | null {
  if (!date) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

/* Referral-status badge variant — same vocabulary as the nurse/guidance
   alerts queues so every surface agrees. */
export function referralStatusVariant(
  status: string | undefined,
): "warning" | "default" | "secondary" | "outline" | "destructive" | "success" {
  switch (status) {
    case "pending":
      return "warning";
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

export interface AdmHistoryEvent {
  id: string;
  actionType: string;
  sourceTable: string;
  reason: string | null;
  oldValue: unknown;
  newValue: unknown;
  actor: string;
  actorRole: string;
  at: string;
}

export async function fetchCaseHistory(
  opts: { profileId?: string; referralId?: string },
  signal?: AbortSignal,
): Promise<AdmHistoryEvent[]> {
  const res = await apiClient.get<{ events: AdmHistoryEvent[] }>("/api/adm/history", {
    params: {
      ...(opts.profileId ? { profileId: opts.profileId } : {}),
      ...(opts.referralId ? { referralId: opts.referralId } : {}),
    },
    signal,
  });
  return res.data.events;
}

export interface AdmMeeting {
  id: string;
  meetingDatetime: string;
  venue: string;
  attended: boolean;
  parentConfirmedAt: string | null;
  minutesOfMeeting: string | null;
  attendanceLogbookRef: string | null;
  attendees: MeetingAttendee[];
  recordedBy: string;
}

export function venueLabel(venue: string): string {
  return venue === "home" ? "Home visit" : "In school";
}

/* People present at a parent meeting, logged by the ADM Coordinator with
   the outcome. Stored as a JSON array of { name, role }; roles come from
   the fixed set the API enforces. */
export type MeetingAttendeeRole =
  | "parent_guardian"
  | "teacher"
  | "student"
  | "guidance_counselor"
  | "nurse"
  | "principal"
  | "lrpc"
  | "other";

export interface MeetingAttendee {
  name: string;
  role: MeetingAttendeeRole;
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
    const raw = item as { name?: unknown; role?: unknown };
    if (typeof raw.name !== "string" || !raw.name.trim()) continue;
    out.push({
      name: raw.name.trim().slice(0, 100),
      role: (typeof raw.role === "string" && ATTENDEE_ROLES.has(raw.role)
        ? raw.role
        : "other") as MeetingAttendeeRole,
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

export async function fetchCaseMeetings(
  profileId: string,
  signal?: AbortSignal,
): Promise<AdmMeeting[]> {
  const res = await apiClient.get<{ meetings: AdmMeeting[] }>(
    `/api/adm/${profileId}/meetings`,
    { signal },
  );
  return (res.data.meetings ?? []).map((m) => ({
    ...m,
    attendees: parseMeetingAttendees(
      (m as { attendees?: unknown }).attendees,
    ),
  }));
}

export interface CoordinatorCaseAnecdotal {
  id: string;
  observationDatetime: string;
  observationDate: string;
  category: string;
  confidentialityLevel: string;
  descriptionOfIncident: string;
  descriptionOfLocation: string | null;
  recommendations: string | null;
  classPerformance: string | null;
  attendanceSummary: string | null;
  observer: string;
  section: string;
}

export interface CoordinatorCaseDetail {
  id: string;
  kind: "profile" | "referral";
  profileId: string | null;
  referralId: string | null;
  student: string;
  lrn: string;
  grade: string;
  stage: string;
  eligibilityStatus: AdmEligibility;
  preparedBy: string;
  datePrepared: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  certificationDetails: unknown;
  referral: {
    id: string;
    reason: string;
    status: string;
    consultReviewer: string | null;
    referralFormReady: boolean;
    notes: string | null;
    priority: string | null;
    intakeNotes: string | null;
    resolutionSummary: string | null;
    referredBy: string;
  } | null;
  anecdotal: CoordinatorCaseAnecdotal | null;
  gcForm03: { ready: boolean } | null;
  forms: AdmFormRef[];
  meetings: {
    id: string;
    meetingDatetime: string;
    venue: string;
    attended: boolean;
    parentConfirmedAt: string | null;
    minutesOfMeeting: string | null;
    attendanceLogbookRef: string | null;
    attendees: MeetingAttendee[];
    recordedBy: string;
  }[];
  sessions: {
    id: string;
    sessionType: string;
    scheduledAt: string;
    venue: string | null;
    status: string;
    sessionNotes: string | null;
    outcome: string | null;
  }[];
}

export async function fetchCoordinatorCaseDetail(
  id: string,
  signal?: AbortSignal,
): Promise<CoordinatorCaseDetail> {
  const res = await apiClient.get<CoordinatorCaseDetail>(
    `/api/adm/case/${encodeURIComponent(id)}`,
    { signal },
  );
  const data = res.data;
  return {
    ...data,
    meetings: (data.meetings ?? []).map((m) => ({
      ...m,
      attendees: parseMeetingAttendees(
        (m as { attendees?: unknown }).attendees,
      ),
    })),
  };
}
