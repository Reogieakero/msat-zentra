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

  anecdotalId?: string;

  riskLevel?: string | null;

  consultReviewer?: string;
  category?: string;
  anecdotalExcerpt?: string;
  location?: string;
  recommendations?: string;
  reviewed?: boolean;

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

  reviewed?: number;
  scopedTotal?: number;
  byStage?: GuidanceAdmStageCount[];
  byEligibility?: GuidanceAdmEligibilityCount[];
  byAction?: GuidanceAdmActionCount[];
  referralTrend?: GuidanceAdmTrendWeek[];
}

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
