export type InterventionApproval =
  | "pending"
  | "approved"
  | "rejected"
  | "modified";

export type InterventionOutcome = "ongoing" | "resolved" | "unresolved";

export type RiskLevelFilter = "High" | "Moderate" | "All";
export type FactorFilter =
  | ""
  | "Academic"
  | "Attendance"
  | "Behavioral";
export type FollowUpStatusFilter = "" | InterventionOutcome | "all";

export interface AtRiskFactors {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

export type CounselingSessionType =
  | "individual"
  | "parent_conference"
  | "group"
  | "home_visit";

export interface CounselingSessionItem {
  id: string;
  sessionType: CounselingSessionType;
  scheduledAt: string;
  date: string;
  venue: string;
  status: "scheduled" | "completed" | "cancelled";
  sessionNotes: string;
  outcome: string;
  cancelReason: string;

  cancelledByRole?: string | null;

  createdAt: string;
  completedAt: string;
  attachmentsCount: number;
}

export interface StudentFollowUp {
  id: string;
  recommendedAction: string;
  assigneeId: string;
  assignee: string;
  approvalStatus: InterventionApproval;
  outcomeStatus: InterventionOutcome;
  outcomeNotes: string;
  priority: string;
  intakeNotes: string;
  sessions: CounselingSessionItem[];
  completedSessions: number;

  createdAt: string | null;
}

export interface ReferralContext {
  open: number;
  closed: number;
}

export interface AtRiskStudentItem {
  studentKey: string;
  lrn: string;
  student: string;
  section: string;
  grade: string;
  riskLevel: string;
  riskCount: number;

  detectedAt: string | null;
  factors: AtRiskFactors;

  referralContext: ReferralContext;
  intervention: StudentFollowUp | null;
}

export interface GuidanceInterventionsSummary {
  high: number;
  moderate: number;
  waitingReview: number;
  ongoing: number;
  resolved: number;
  mine: number;
}

export interface GuidanceInterventionsData {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  page: number;
  pageSize: number;

  total: number;
  totalPages: number;

  unfilteredTotal?: number;
}

export interface GuidanceInterventionsParams {
  q?: string;
  level?: RiskLevelFilter;
  factor?: FactorFilter;
  outcome?: FollowUpStatusFilter;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface InterventionSessionDoc {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface InterventionStaffMember {
  id: string;
  fullName: string;
  role: string;
}

export type ReviewDecision = "approved" | "rejected" | "modified";

export interface EngineBreakdownSubject {
  code: string;
  name: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  below: boolean;
}

export interface EngineAttendanceSubject {
  code: string;
  name: string;
  present: number;
  total: number;
  rate: number | null;
}

export interface EngineBreakdown {
  live: {
    level: string;
    count: number;
    academic: boolean;
    attendance: boolean;
    behavioral: boolean;
  };
  academic: {
    average: number | null;
    transmutedAverage: number | null;
    subjectCount: number;
    threshold: number;
    subjects: EngineBreakdownSubject[];
  };
  attendance: {
    rate: number | null;
    present: number;
    total: number;
    subjectEra: boolean;
    threshold: number;
    bySubject: EngineAttendanceSubject[];
    general: { present: number; total: number; rate: number } | null;
  };
  behavioral: {
    count: number;
    recent: { category: string; date: string }[];
  };
  stored: { level: string; count: number; date: string } | null;
  flagged: { level: string } | null;
}

export interface StartFollowUpInput {
  recommendedAction: string;
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
