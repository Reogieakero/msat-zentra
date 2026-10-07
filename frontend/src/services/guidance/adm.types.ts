// ADM queue shapes for the guidance desk. Pure types only.
export type GuidanceAdmStageFilter =
  | ""
  | "consultation"
  | "meeting_parents"
  | "home_visitation"
  | "certification"
  | "principal_approval"
  | "enrollment_monitoring"
  | "completion";

export interface GuidanceAdmCase {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  stage: string;
  stageLabel: string;
  eligibility: string;
  referralId: string;
  referralStatus: string;
  reason: string;
  referredBy: string;
  preparedBy: string;
  date: string;
  meetingAttended: boolean | null;
  hasHomeVisit: boolean;
  approved: boolean;
  approvedAt: string | null;
  /* Consultation-review context (early ADM referrals only): the linked
     anecdotal id so the counselor can open the official report, plus whether
     this case was already decided out of the consultation stage. */
  anecdotalId?: string;
  /* Latest engine risk level for the student (null when never flagged). */
  riskLevel?: string | null;
  /* Teacher-picked consultation reviewer — this queue only ever carries
     guidance-picked (or legacy unpicked) cases. */
  consultReviewer?: string;
  category?: string;
  anecdotalExcerpt?: string;
  location?: string;
  recommendations?: string;
  reviewed?: boolean;
  /* Raw review note (`[ADM consult] ...`) for rebuilding the GCForm-03
     guidance-recommendations line in the referral-form viewer. */
  consultNote?: string | null;
}

export interface GuidanceAdmStageCount {
  stage: string;
  label: string;
  count: number;
}

export interface GuidanceAdmEligibilityCount {
  eligibility: string;
  label: string;
  count: number;
}

export interface GuidanceAdmActionCount {
  action: string;
  label: string;
  count: number;
}

export interface GuidanceAdmTrendWeek {
  week: string;
  label: string;
  count: number;
}

export interface GuidanceAdmSummary {
  total: number;
  consultation: number;
  meetingParents: number;
  homeVisitation: number;
  certification: number;
  principalApproval: number;
  needsHomeVisit: number;
  awaitingReview: number;
  consultationAction: number;
  // Reports breakdowns (optional for backward-compat with cached responses).
  // Guidance ADM only — never the school-wide tracker counts.
  reviewed?: number;
  scopedTotal?: number;
  byStage?: GuidanceAdmStageCount[];
  byEligibility?: GuidanceAdmEligibilityCount[];
  byAction?: GuidanceAdmActionCount[];
  referralTrend?: GuidanceAdmTrendWeek[];
}

/* One open guidance referral waiting on the counselor's consultation action.
   Counsel here first — handing off moves it to the ADM coordinator. */
export interface GuidanceAdmConsultationCase {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;
  category: string;
  reason: string;
  status: string;
  priority: string;
  referredBy: string;
  date: string;
  completedSessions: number;
  totalSessions: number;
}

export interface GuidanceAdmData {
  summary: GuidanceAdmSummary;
  counselorName: string;
  consultationQueue: GuidanceAdmConsultationCase[];
  /* Latest ADM cases referred to guidance still needing review (top section). */
  reviewQueue: GuidanceAdmCase[];
  cases: GuidanceAdmCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GuidanceAdmParams {
  q?: string;
  stage?: GuidanceAdmStageFilter;
  page?: number;
  pageSize?: number;
}

/* Counseling sessions on one ADM consultation (booked from the review
   dialog without deciding, or with the endorsement). Shared session
   endpoints — completing, moving, cancelling, and deleting go through
   the referrals sessions service, same as the referrals page. */
export interface AdmConsultationSession {
  id: string;
  sessionType: string;
  scheduledAt: string;
  date: string;
  venue: string;
  status: string;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  createdAt: string;
  completedAt: string;
}
