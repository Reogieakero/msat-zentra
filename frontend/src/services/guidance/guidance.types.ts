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

  cancelledByRole?: string | null;

  createdAt: string;
  completedAt: string;

  attachments: CounselingSessionAttachment[];
}

export interface GuidanceReferralItem {
  id: string;
  student: string;
  lrn: string;
  section: string;
  grade: string;

  studentId: string | null;

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

  lastActionAt: string;
  lastActionType: string;

  dismissedByRole?: string | null;
}

export interface GuidanceTypeSummary {
  pending: number;
  inProgress: number;
  followUp: number;
  escalated: number;

  infoRequested?: number;
  resolved: number;
  dismissed: number;

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

  byType?: Record<"Counseling" | "ADM", GuidanceTypeSummary>;
}

export interface GuidanceReferralsData {
  summary: GuidanceReferralsSummary;
  referrals: GuidanceReferralItem[];
  page: number;
  pageSize: number;

  total: number;
  totalPages: number;

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
