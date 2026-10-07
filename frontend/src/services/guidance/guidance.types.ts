// Shared shapes for the guidance desk. Pure types only — no runtime
// imports, so UI files can `import type` without pulling in fetch logic.
export type GuidanceReferralStatus =
  | "pending"
  | "in_progress"
  | "resolved"
  | "escalated"
  | "info_requested"
  | "dismissed"
  | "follow_up";

export type CounselingSessionType =
  | "individual"
  | "parent_conference"
  | "group"
  | "home_visit";

export type CounselingSessionStatus = "scheduled" | "completed" | "cancelled";

export interface CounselingSessionAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface CounselingSessionItem {
  id: string;
  sessionType: CounselingSessionType;
  scheduledAt: string;
  date: string;
  venue: string;
  status: CounselingSessionStatus;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  // Role behind the latest session_cancelled audit, when cancelled
  // (backend audit trail). Adviser/subject-teacher = the withdrawal
  // auto-cancel cascade; a desk role = that desk cancelled it.
  cancelledByRole?: string | null;
  // When the session was booked (execution time). Falls back to
  // scheduledAt for legacy rows without it.
  createdAt: string;
  completedAt: string;
  // Optional documentation filed on the session (photos). Empty when
  // nothing is filed — docs never gate Done.
  attachments: CounselingSessionAttachment[];
}

export interface GuidanceReferralItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  // Account userId (or roster id for enlisted students without accounts)
  // for the live risk lookup. The endpoint serves both.
  studentId: string | null;
  // Action track: "ADM" needs ADM action (escalated toward the ADM
  // coordinator), otherwise regular "Counseling" handled on this desk.
  type: string;
  category: string;
  referredBy: string;
  observer: string;
  reason: string;
  status: GuidanceReferralStatus;
  date: string;
  anecdotalId: string;
  anecdotalExcerpt: string;
  location: string;
  recommendations: string;
  confidentiality: string;
  notes?: string;
  escalationReason?: string;
  followUpDate?: string;
  escalatedTo?: string;
  priority: string;
  intakeNotes: string;
  acceptedAt: string;
  resolutionSummary: string;
  sessions: CounselingSessionItem[];
  completedSessions: number;
  // Latest execution across referral + sessions (backend audit, ISO).
  // Empty when no audit trail exists (legacy rows) — callers fall back.
  lastActionAt: string;
  lastActionType: string;
  // Role behind the dismissal, when dismissed (backend audit trail).
  // Adviser/subject-teacher withdrawals read "Cancelled", desk decisions
  // read "Reject". Absent when never dismissed.
  dismissedByRole?: string | null;
}

export interface GuidanceTypeSummary {
  pending: number;
  inProgress: number;
  followUp: number;
  escalated: number;
  // Optional for backward-compat with cached responses.
  infoRequested?: number;
  resolved: number;
  dismissed: number;
  // Adviser/subject-teacher withdrawals (subset of dismissed). Optional for
  // backward-compat with cached responses predating the split.
  cancelled?: number;
  booked: number;
  done: number;
  open: number;
}

export interface GuidanceReferralsSummary {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  escalated?: number;
  infoRequested?: number;
  dismissed?: number;
  followUp?: number;
  // Per-track totals for the sidebar's separate Counseling vs ADM menus.
  byType?: Record<"Counseling" | "ADM", GuidanceTypeSummary>;
}

export interface GuidanceReferralsData {
  summary: GuidanceReferralsSummary;
  referrals: GuidanceReferralItem[];
  page: number;
  pageSize: number;
  /** Filtered pager count (shrinks on search/filter). */
  total: number;
  totalPages: number;
  /** UNFILTERED desk total — tile stats never shrink on search. */
  unfilteredTotal?: number;
}

export interface GuidanceReferralsParams {
  q?: string;
  status?: "" | GuidanceReferralStatus;
  type?: "" | "counseling" | "adm";
  booked?: boolean;
  completed?: boolean;
  open?: boolean;
  page?: number;
  pageSize?: number;
  /** Deep-link landing: the backend serves the page containing this case. */
  highlight?: string;
}

export interface AcceptReferralInput {
  priority: "low" | "normal" | "high";
  intakeNotes?: string;
  firstSession?: {
    scheduledAt: string;
    sessionType: CounselingSessionType;
    venue?: string;
  };
}

export interface ScheduleSessionInput {
  scheduledAt: string;
  sessionType: CounselingSessionType;
  venue?: string;
}

export type GuidanceRiskLevel = "High" | "Moderate" | "Low";
