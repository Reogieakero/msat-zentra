import { apiClient } from "@/lib/api/client";
import { formatGrade, formatSection } from "@/lib/utils";

// Raw shapes returned by GET /api/referrals/ (nurse role is allowed).
// DateTime fields arrive as ISO strings. Only the fields the overview
// reads are typed; the endpoint includes full related records.
interface RawAnecdotal {
  id: string;
  observationDatetime: string;
  category?: string | null;
  descriptionOfIncident?: string | null;
  descriptionOfLocation?: string | null;
  notesRecommendationsActions?: string | null;
  classPerformance?: string | null;
  attendanceSummary?: string | null;
}

interface RawStudent {
  userId: string;
  lrn: string;
  gradeLevel?: string | null;
  section?: { name?: string | null } | null;
}

interface RawRoster {
  id: string;
  lrn?: string | null;
  fullName?: string | null;
  gradeLevel?: string | null;
  section?: { name?: string | null } | null;
}

export interface RawReferral {
  id: string;
  referredToRole?: string | null;
  reason?: string | null;
  status?: string | null;
  escalatedTo?: string | null;
  // Set only on ADM-track referrals (the picked consultation reviewer).
  consultReviewer?: string | null;
  // True once the nurse completes the referral form on the dedicated form
  // page — only then may the case be forwarded to the ADM coordinator.
  referralFormReady?: boolean | null;
  followUpDate?: string | null;
  resolvedAt?: string | null;
  // Free-text fields the timeline surfaces (callouts). Present at runtime
  // (the endpoint spreads the full referral row); defaulted when absent.
  intakeNotes?: string | null;
  notes?: string | null;
  escalationReason?: string | null;
  // When the case was actually referred (earliest audit entry; falls back
  // to the observation date for legacy rows). Drives the "waiting" clock.
  referredAt?: string | null;
  anecdotalRecord?: RawAnecdotal | null;
  student?: RawStudent | null;
  roster?: RawRoster | null;
  counselingSessions?: RawSession[] | null;
}

interface RawSession {
  id: string;
  sessionType?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  status?: string | null;
  sessionNotes?: string | null;
  outcome?: string | null;
  cancelReason?: string | null;
  completedAt?: string | null;
}

export interface NurseSessionItem {
  id: string;
  sessionType: string;
  scheduledAt: string;
  date: string;
  venue: string;
  status: string;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  completedAt: string;
}

export interface NurseKpis {
  needsReview: number;
  inProgress: number;
  escalatedToMe: number;
  resolved: number;
  healthRelated: number;
  total: number;
}

export interface NurseQueueRow {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  // "ADM" when a teacher picked an ADM consultation reviewer for this case
  // (consultReviewer is only set on ADM-track referrals); otherwise a
  // regular clinic matter.
  type: string;
  // True once the referral form is completed — the alerts page then shows
  // the explicit Endorse & forward button for the case.
  referralReady: boolean;
  category: string;
  reason: string;
  status: string;
  date: string;
  waitingDays: number | null;
  // Optional context lines for the timeline view ("" when unset).
  followUpDate: string;
  intakeNotes: string;
  notes: string;
  escalationReason: string;
  // Underlying anecdotal record — needed for follow-up notes. Null for
  // legacy rows without one.
  anecdotalId: string | null;
  // The anecdotal write-up for review (ADM consultation). Null when the
  // referral carries no record.
  anecdotal: {
    observedAt: string;
    category: string;
    location: string;
    incident: string;
    classPerformance: string;
    attendanceSummary: string;
    notes: string;
  } | null;
  // Clinic sessions booked on the case, oldest first (same counseling-plan
  // workflow as the guidance referrals page).
  sessions: NurseSessionItem[];
  completedSessions: number;
}

export interface NurseFollowUpRow extends NurseQueueRow {
  dueDate: string;
  overdueDays: number | null;
}

export interface NurseBreakdownRow {
  key: string;
  label: string;
  count: number;
}

export interface NurseOverviewData {
  kpis: NurseKpis;
  needsReview: NurseQueueRow[];
  followUpsDue: NurseFollowUpRow[];
  statusBreakdown: NurseBreakdownRow[];
  categoryBreakdown: NurseBreakdownRow[];
}

export const NURSE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  in_progress: "In progress",
  follow_up: "Follow-up",
  info_requested: "Needs info",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// A referral belongs on the nurse's desk when:
//  - it was routed to the nurse role, or
//  - another role escalated it specifically to the nurse, or
//  - it is an ADM-track referral the adviser sent to the nurse as the
//    consultation reviewer (guidance is locked out of these server-side,
//    so the nurse is their only owner at the consultation stage).
export function isNurseScope(r: RawReferral): boolean {
  if (r.referredToRole === "nurse") return true;
  if (r.status === "escalated" && r.escalatedTo === "nurse") return true;
  if (r.referredToRole === "adm_coordinator" && r.consultReviewer === "nurse") return true;
  return false;
}

function identityOf(r: RawReferral): { student: string; lrn: string; section: string; grade: string } {
  if (r.roster) {
    return {
      student: r.roster.fullName?.trim() || (r.roster.lrn ? `Student ${r.roster.lrn}` : "Unknown student"),
      lrn: r.roster.lrn ?? "—",
      section: formatSection(r.roster.section?.name) || "—",
      grade: formatGrade(r.roster.gradeLevel) || "—",
    };
  }
  if (r.student) {
    return {
      student: `Student ${r.student.lrn}`,
      lrn: r.student.lrn,
      section: formatSection(r.student.section?.name) || "—",
      grade: formatGrade(r.student.gradeLevel) || "—",
    };
  }
  return { student: "Unknown student", lrn: "—", section: "—", grade: "—" };
}

export function toSessionItem(s: RawSession): NurseSessionItem {
  return {
    id: s.id,
    sessionType: s.sessionType ?? "individual",
    scheduledAt: s.scheduledAt ?? "",
    date: parseDate(s.scheduledAt)?.toISOString().slice(0, 10) ?? "",
    venue: s.venue ?? "",
    status: s.status ?? "scheduled",
    sessionNotes: s.sessionNotes ?? "",
    outcome: s.outcome ?? "",
    cancelReason: s.cancelReason ?? "",
    completedAt: parseDate(s.completedAt)?.toISOString().slice(0, 10) ?? "",
  };
}

export function toQueueRow(r: RawReferral): NurseQueueRow {
  const identity = identityOf(r);
  // Waiting counts from when the case was referred, not when the incident
  // was observed — a case filed weeks ago but referred today waits 0 days.
  const referred = parseDate(r.referredAt) ?? parseDate(r.anecdotalRecord?.observationDatetime);
  const anec = r.anecdotalRecord ?? null;
  const observed = parseDate(anec?.observationDatetime);
  const sessions = (r.counselingSessions ?? []).map(toSessionItem);
  return {
    id: r.id,
    ...identity,
    type: r.consultReviewer ? "ADM" : "Clinic",
    referralReady: r.referralFormReady === true,
    category: anec?.category ? titleCase(anec.category) : "—",
    reason: r.reason?.trim() ? r.reason.trim().slice(0, 140) : "No reason recorded",
    status: r.status ?? "pending",
    date: referred ? referred.toISOString().slice(0, 10) : "—",
    waitingDays: referred ? Math.max(0, wholeDaysBetween(referred, startOfToday())) : null,
    followUpDate: parseDate(r.followUpDate)?.toISOString().slice(0, 10) ?? "",
    intakeNotes: r.intakeNotes?.trim() ?? "",
    notes: r.notes?.trim() ?? "",
    escalationReason: r.escalationReason?.trim() ?? "",
    sessions,
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    anecdotalId: anec?.id ?? null,
    anecdotal: anec
      ? {
          observedAt: observed ? observed.toISOString().slice(0, 10) : "—",
          category: anec.category ? titleCase(anec.category) : "—",
          location: anec.descriptionOfLocation?.trim() || "—",
          incident: anec.descriptionOfIncident?.trim() || "—",
          classPerformance: anec.classPerformance?.trim() || "—",
          attendanceSummary: anec.attendanceSummary?.trim() || "—",
          notes: anec.notesRecommendationsActions?.trim() || "—",
        }
      : null,
  };
}

// Pure aggregation over the referrals list. Kept side-effect free so the
// numbers on this page always derive from one fetch, one filter, one pass.
export function buildNurseOverview(referrals: RawReferral[]): NurseOverviewData {
  const scoped = referrals.filter(isNurseScope);
  const today = startOfToday();

  const kpis: NurseKpis = {
    needsReview: scoped.filter((r) => r.status === "pending").length,
    inProgress: scoped.filter((r) => r.status === "in_progress" || r.status === "follow_up" || r.status === "info_requested").length,
    escalatedToMe: scoped.filter((r) => r.status === "escalated" && r.escalatedTo === "nurse").length,
    resolved: scoped.filter((r) => r.status === "resolved").length,
    healthRelated: scoped.filter((r) => r.anecdotalRecord?.category === "health").length,
    total: scoped.length,
  };

  const needsReview = scoped
    .filter((r) => r.status === "pending" || (r.status === "escalated" && r.escalatedTo === "nurse"))
    .map(toQueueRow)
    .sort((a, b) => (b.waitingDays ?? -1) - (a.waitingDays ?? -1));

  const followUpsDue = scoped
    .filter((r) => {
      if (!r.followUpDate || r.status === "resolved" || r.status === "dismissed") return false;
      const due = parseDate(r.followUpDate);
      return due !== null && due <= today;
    })
    .map((r) => {
      const row = toQueueRow(r);
      const due = parseDate(r.followUpDate) as Date;
      return {
        ...row,
        dueDate: due.toISOString().slice(0, 10),
        overdueDays: Math.max(0, wholeDaysBetween(due, today)),
      };
    })
    .sort((a, b) => (b.overdueDays ?? -1) - (a.overdueDays ?? -1));

  const statusOrder = ["pending", "in_progress", "follow_up", "info_requested", "escalated", "resolved", "dismissed"];
  const statusCounts = new Map<string, number>();
  for (const r of scoped) statusCounts.set(r.status ?? "pending", (statusCounts.get(r.status ?? "pending") ?? 0) + 1);
  const statusBreakdown: NurseBreakdownRow[] = [
    ...statusOrder
      .filter((s) => (statusCounts.get(s) ?? 0) > 0)
      .map((s) => ({ key: s, label: NURSE_STATUS_LABELS[s] ?? titleCase(s), count: statusCounts.get(s) ?? 0 })),
    ...[...statusCounts.keys()]
      .filter((s) => !statusOrder.includes(s))
      .map((s) => ({ key: s, label: NURSE_STATUS_LABELS[s] ?? titleCase(s), count: statusCounts.get(s) ?? 0 })),
  ];

  const categoryCounts = new Map<string, number>();
  for (const r of scoped) {
    const key = r.anecdotalRecord?.category ?? "unknown";
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  const categoryBreakdown: NurseBreakdownRow[] = [...categoryCounts.entries()]
    .map(([key, count]) => ({ key, label: key === "unknown" ? "Uncategorized" : titleCase(key), count }))
    .sort((a, b) => b.count - a.count);

  return { kpis, needsReview, followUpsDue, statusBreakdown, categoryBreakdown };
}

export async function fetchNurseOverview(): Promise<NurseOverviewData> {
  const { data } = await apiClient.get<RawReferral[] | { referrals: RawReferral[] }>("/api/referrals/");
  const list = Array.isArray(data) ? data : (data?.referrals ?? []);
  return buildNurseOverview(list);
}

export type NurseReferralStatus =
  | "pending"
  | "in_progress"
  | "follow_up"
  | "info_requested"
  | "resolved"
  | "dismissed"
  | "escalated";

// Clinic intake: accept the case with first impressions and an optional
// first clinic session booked on the spot (POST /api/referrals/:id/nurse-accept).
export interface NurseAcceptInput {
  intakeNotes?: string;
  scheduledAt?: string;
  venue?: string;
}

export async function acceptNurseCase(id: string, input: NurseAcceptInput): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.intakeNotes?.trim()) body.intakeNotes = input.intakeNotes.trim();
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  await apiClient.post(`/api/referrals/${id}/nurse-accept`, body);
}

// ADM consultation review by the nurse (POST /api/referrals/:id/nurse-adm-review).
// Endorse forwards the case to the ADM coordinator; reject closes it.
// An optional first clinic session can be booked alongside an endorsement
// (scheduledAt "YYYY-MM-DDTHH:MM:SS", optional venue), plus the referral
// form fill-up (concerns / details / actions / follow-up) the nurse
// completes before forwarding — same gate as the guidance Create-referral
// flow.
export interface NurseAdmReferralForm {
  concerns?: string[];
  detailsOfConcern?: string;
  nurseActions?: string;
  followUp?: string;
}

export async function reviewNurseAdmCase(
  id: string,
  input: { recommendation: string; outcome: "endorse" | "reject"; scheduledAt?: string; venue?: string; referralForm?: NurseAdmReferralForm },
): Promise<void> {
  const body: Record<string, unknown> = {
    recommendation: input.recommendation,
    outcome: input.outcome,
  };
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  const form = buildReferralFormBody(input.referralForm);
  if (form) body.referralForm = form;
  await apiClient.post(`/api/referrals/${id}/nurse-adm-review`, body);
}

function buildReferralFormBody(input: NurseAdmReferralForm | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const form: Record<string, unknown> = {};
  if (input.concerns?.length) form.concerns = input.concerns;
  if (input.detailsOfConcern?.trim()) form.detailsOfConcern = input.detailsOfConcern.trim();
  if (input.nurseActions?.trim()) form.nurseActions = input.nurseActions.trim();
  if (input.followUp?.trim()) form.followUp = input.followUp.trim();
  return Object.keys(form).length > 0 ? form : null;
}

// Save the referral form on the dedicated form page
// (POST /api/referrals/:id/nurse-referral-form). The case STAYS pending —
// forwarding to the coordinator happens only through forwardNurseAdmCase.
export async function saveNurseReferralForm(
  id: string,
  input: { recommendation: string; scheduledAt?: string; venue?: string; referralForm?: NurseAdmReferralForm },
): Promise<void> {
  const body: Record<string, unknown> = {
    recommendation: input.recommendation,
  };
  if (input.scheduledAt) {
    body.clinicSession = {
      scheduledAt: input.scheduledAt,
      ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
    };
  }
  const form = buildReferralFormBody(input.referralForm);
  if (form) body.referralForm = form;
  await apiClient.post(`/api/referrals/${id}/nurse-referral-form`, body);
}

// Explicit forward of a form-ready ADM case to the ADM coordinator
// (POST /api/referrals/:id/nurse-adm-forward). Server rejects cases whose
// referral form was never completed.
export async function forwardNurseAdmCase(id: string): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/nurse-adm-forward`);
}

// Status changes the nurse role is allowed to make
// (POST /api/referrals/:id/status).
export async function updateNurseReferralStatus(
  id: string,
  status: NurseReferralStatus,
  resolutionSummary?: string,
): Promise<void> {
  await apiClient.post(
    `/api/referrals/${id}/status`,
    resolutionSummary ? { status, resolutionSummary } : { status },
  );
}

// Follow-up notes on the underlying anecdotal record
// (POST /api/anecdotal/:id/followups).
export async function addNurseFollowUpNote(anecdotalId: string, notes: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${anecdotalId}/followups`, { notes });
}

// Clinic sessions on one referral — the same schedule / complete / move /
// cancel workflow as the guidance referrals page (POST
// /api/referrals/:id/sessions*). Nurse sessions are always one-on-one
// clinic talks at the school clinic unless another venue is given.
export interface NurseScheduleSessionInput {
  scheduledAt: string;
  venue?: string;
}

export async function scheduleClinicSession(
  id: string,
  input: NurseScheduleSessionInput
): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/sessions`, {
    scheduledAt: input.scheduledAt,
    sessionType: "individual",
    ...(input.venue?.trim() ? { venue: input.venue.trim() } : {}),
  });
}

export async function completeClinicSession(
  id: string,
  sessionId: string,
  input: { sessionNotes: string; outcome?: string; followUpAt?: string; followUpVenue?: string }
): Promise<void> {
  const body: Record<string, unknown> = { sessionNotes: input.sessionNotes };
  if (input.outcome?.trim()) body.outcome = input.outcome.trim();
  if (input.followUpAt) {
    body.followUpSession = {
      scheduledAt: input.followUpAt,
      sessionType: "individual",
      ...(input.followUpVenue?.trim() ? { venue: input.followUpVenue.trim() } : {}),
    };
  }
  await apiClient.post(`/api/referrals/${id}/sessions/${sessionId}/complete`, body);
}

export async function rescheduleClinicSession(
  id: string,
  sessionId: string,
  scheduledAt: string
): Promise<void> {
  await apiClient.post(`/api/referrals/${id}/sessions/${sessionId}/reschedule`, {
    scheduledAt,
  });
}

export async function cancelClinicSession(
  id: string,
  sessionId: string,
  cancelReason?: string
): Promise<void> {
  await apiClient.post(
    `/api/referrals/${id}/sessions/${sessionId}/cancel`,
    cancelReason?.trim() ? { cancelReason: cancelReason.trim() } : {}
  );
}

// Stash passed from the Review ADM dialog to the dedicated referral form
// page (/nurse/adm/referral/[referralId]) — same handoff pattern as the
// guidance Create-referral flow: the typed recommendation plus the optional
// clinic session travel in sessionStorage so the form page opens pre-filled.
export const NURSE_REFERRAL_DRAFT_KEY = "zentra.nurse-adm-referral-draft";

export interface NurseReferralDraft {
  recommendation: string;
  scheduledAt?: string;
}

export function saveNurseReferralDraft(draft: NurseReferralDraft): void {
  try {
    window.sessionStorage.setItem(NURSE_REFERRAL_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* Private mode — the form page still works, fields start empty. */
  }
}

export function loadNurseReferralDraft(): NurseReferralDraft | null {
  try {
    const raw = window.sessionStorage.getItem(NURSE_REFERRAL_DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(NURSE_REFERRAL_DRAFT_KEY);
    const parsed = JSON.parse(raw) as Partial<NurseReferralDraft>;
    if (parsed && typeof parsed.recommendation === "string") {
      return {
        recommendation: parsed.recommendation,
        ...(typeof parsed.scheduledAt === "string" ? { scheduledAt: parsed.scheduledAt } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Backend errors arrive as { error: { code, message } } — surface the
// server's message instead of a generic failure notice.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}
