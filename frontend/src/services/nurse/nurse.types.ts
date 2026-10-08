export interface RawReferral {
  id: string;
  referredToRole?: string | null;
  reason?: string | null;
  status?: string | null;
  escalatedTo?: string | null;

  consultReviewer?: string | null;

  referralFormReady?: boolean | null;
  followUpDate?: string | null;
  resolvedAt?: string | null;

  intakeNotes?: string | null;
  notes?: string | null;
  escalationReason?: string | null;

  referredAt?: string | null;

  lastActionAt?: string | null;
  lastActionType?: string | null;

  dismissedByRole?: string | null;
  anecdotalRecord?: RawAnecdotal | null;
  student?: RawStudent | null;
  roster?: RawRoster | null;
  counselingSessions?: RawSession[] | null;
}

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

  cancelledByRole?: string | null;

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

  cancelledByRole?: string | null;

  createdAt: string;
  completedAt: string;

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

  type: string;

  consultReviewer?: string | null;

  referralReady: boolean;
  category: string;
  reason: string;
  status: string;
  date: string;
  waitingDays: number | null;

  referredAt: string;

  followUpDate: string;
  intakeNotes: string;
  notes: string;
  escalationReason: string;

  anecdotalId: string | null;

  anecdotal: {
    observedAt: string;
    category: string;
    location: string;
    incident: string;
    classPerformance: string;
    attendanceSummary: string;
    notes: string;
  } | null;

  sessions: NurseSessionItem[];
  completedSessions: number;

  lastActionAt: string;
  lastActionType: string;

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

export interface NurseAcceptInput {
  intakeNotes?: string;
  scheduledAt?: string;
  venue?: string;
}

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

export interface NurseScheduleSessionInput {
  scheduledAt: string;
  venue?: string;
}

export interface NurseReferralDraft {
  recommendation: string;
  scheduledAt?: string;
}

export type NurseAlertSeverity = "urgent" | "new" | "info" | "done";

export type NurseRiskLevel = "High" | "Moderate" | "Low";

export interface NurseAlertItem {
  key: string;
  severity: NurseAlertSeverity;
  title: string;
  detail: string;

  waiting: string;
  date: string;
  sortTime: number;

  studentId: string | null;
  row: NurseQueueRow;
}

export interface NurseNotificationItem {
  id: string;
  label: string;
  message: string;
  date: string;
  isRead: boolean;
}

export interface NurseAlertsSummary {
  urgent: number;
  fresh: number;
  followUps: number;
  resolvedWeek: number;
  closed: number;
  total: number;
}

export interface NurseAlertsData {
  summary: NurseAlertsSummary;
  alerts: NurseAlertItem[];

  cases: NurseAlertItem[];
  notifications: NurseNotificationItem[];
  unread: number;
}

export interface NurseAlertsPageParams {
  q?: string;
  page?: number;
  pageSize?: number;
  track?: "clinic" | "adm";
  highlight?: string;
  signal?: AbortSignal;
}

export interface NurseAlertsPage extends NurseAlertsData {

  total: number;

  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

export type NurseRiskFactors = {
  Academic: boolean;
  Attendance: boolean;
  Behavioral: boolean;
};
