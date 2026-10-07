// Shared shapes for the nurse desk. Pure types only — no runtime imports,
// so UI files can `import type` without pulling in fetch logic.
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
  // Latest execution across the referral + its sessions (backend audit).
  // This is the wall-clock time the last action ran — use it for display,
  // never the future appointment time.
  lastActionAt?: string | null;
  lastActionType?: string | null;
  // Role behind the latest dismissal audit (backend audit trail) — drives
  // the watermark ("Cancelled" for adviser withdrawals vs "Reject" for
  // desk decisions). Null when never dismissed.
  dismissedByRole?: string | null;
  anecdotalRecord?: RawAnecdotal | null;
  student?: RawStudent | null;
  roster?: RawRoster | null;
  counselingSessions?: RawSession[] | null;
}

// Raw shapes returned by GET /api/referrals/ (nurse role is allowed).
// DateTime fields arrive as ISO strings. Only the fields the overview
// reads are typed; the endpoint includes full related records.
export interface RawAnecdotal {
  id: string;
  observationDatetime: string;
  category?: string | null;
  descriptionOfIncident?: string | null;
  descriptionOfLocation?: string | null;
  notesRecommendationsActions?: string | null;
  classPerformance?: string | null;
  attendanceSummary?: string | null;
}

export interface RawStudent {
  userId: string;
  lrn: string;
  gradeLevel?: string | null;
  section?: { name?: string | null } | null;
}

export interface RawRoster {
  id: string;
  lrn?: string | null;
  fullName?: string | null;
  gradeLevel?: string | null;
  section?: { name?: string | null } | null;
}

export interface RawAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface RawSession {
  id: string;
  sessionType?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  status?: string | null;
  sessionNotes?: string | null;
  outcome?: string | null;
  cancelReason?: string | null;
  // Role behind the latest session_cancelled audit, when cancelled
  // (backend audit trail). Adviser/subject-teacher = the withdrawal
  // auto-cancel cascade; a desk role = that desk cancelled it.
  cancelledByRole?: string | null;
  // Execution times (backend): createdAt = when booked, completedAt = when
  // marked done. Never display the future appointment as the action time.
  createdAt?: string | null;
  completedAt?: string | null;
  attachments?: RawAttachment[] | null;
}

export interface ClinicAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
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
  // Role behind the latest session_cancelled audit, when cancelled.
  cancelledByRole?: string | null;
  // When the session was booked (execution time). Falls back to
  // scheduledAt for legacy rows without it.
  createdAt: string;
  completedAt: string;
  // Optional documentation filed on the session (photos). Empty when the
  // nurse closes the case without filing — docs never gate Done.
  attachments: ClinicAttachment[];
}

export interface NurseKpis {
  needsReview: number;
  bookedSession: number;
  endorsedToAdm: number;
  followUp: number;
  doneSession: number;
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
  // Teacher-picked ADM consultation reviewer (nurse on this desk).
  consultReviewer?: string | null;
  // True once the referral form is completed — the alerts page then shows
  // the explicit Endorse & forward button for the case.
  referralReady: boolean;
  category: string;
  reason: string;
  status: string;
  date: string;
  waitingDays: number | null;
  // Full referred timestamp (ISO) — drives the live "Waiting" elapsed
  // clock (referred time → now). Empty when unknown (legacy rows).
  referredAt: string;
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
  // Latest execution across referral + sessions (backend audit, ISO).
  // Empty when no audit trail exists (legacy rows) — callers fall back.
  lastActionAt: string;
  lastActionType: string;
  // Role behind the dismissal, when dismissed (backend audit trail).
  // Adviser/subject-teacher withdrawals read "Cancelled", desk decisions
  // read "Reject". Empty otherwise.
  dismissedByRole: string;
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

export interface NurseTrendPoint {
  date: string;
  adm: number;
  clinic: number;
}

export interface NurseOverviewData {
  kpis: NurseKpis;
  needsReview: NurseQueueRow[];
  statusBreakdown: NurseBreakdownRow[];
  clinicStatusBreakdown: NurseBreakdownRow[];
  admStatusBreakdown: NurseBreakdownRow[];
  dailyTrend: NurseTrendPoint[];
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

// ADM consultation review by the nurse (POST /api/referrals/:id/nurse-adm-review).
export interface NurseAdmReferralForm {
  concerns?: string[];
  detailsOfConcern?: string;
  nurseActions?: string;
  followUp?: string;
}

export interface SavedNurseAdmForm {
  recommendation: string;
  concerns: string[];
  details: string;
  actions: string;
  followUp: string;
}

// Clinic sessions on one referral — the same schedule / complete / move /
// cancel workflow as the guidance referrals page.
export interface NurseScheduleSessionInput {
  scheduledAt: string;
  venue?: string;
}

// Stash passed from the Review ADM dialog to the dedicated referral form
// page (/nurse/adm/referral/[referralId]).
export interface NurseReferralDraft {
  recommendation: string;
  scheduledAt?: string;
}
