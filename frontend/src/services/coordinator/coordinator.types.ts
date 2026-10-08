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

  meeting?: {
    id: string;
    datetime: string;
    venue: string;
    attended: boolean;

    inviteeIds?: string[];
  } | null;

  endorsedAt?: string | null;

  consultReviewer?: string | null;

  referralStatus?: string;

  lastActionAt?: string | null;
  lastActionType?: string | null;

  modulesSubmitted?: number;
  modulesTotal?: number;
}

export interface AdmCaseStatus {
  key: string;
  label: string;
}

export interface AdmDashboard {
  kpis: { pendingSignature: number; signed: number; active: number };
  stageBreakdown: { stage: string; short: string; count: number }[];
  latestReferred: AdmCaseRow[];

  totalReferred?: number;
  needsRevision?: number;
  deviceSummary?: { issued: number; returned: number };
}

export interface AdmReferralsPage {
  rows: AdmCaseRow[];
  total: number;

  unfilteredTotal?: number;
  complete?: number;
  totalReferred: number;
  stageCounts: Record<string, number>;
  page: number;
  totalPages: number;
  limit: number;
  pageSize?: number;
}

export interface AdmApprovalRow extends AdmCaseRow {
  section?: string;

  devicesIssued?: number;
  modulesSubmitted?: number;
  modulesTotal?: number;
}

export interface AdmApprovalsPage {
  rows: AdmApprovalRow[];
  total: number;
  unfilteredTotal?: number;
  page: number;
  totalPages: number;
  limit: number;
  pageSize?: number;
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
  unfilteredTotal?: number;
  complete?: number;
  issued: number;
  returned: number;

  page?: number;
  totalPages?: number;
  limit?: number;
  pageSize?: number;
}

export interface LatestActionFallback {
  label: string;
  at: string;
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

export interface AdmMeetingInvitee {
  id: string;
  fullName: string;
  role: string;
}

export interface AdmMeetingAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
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
  invitees: AdmMeetingInvitee[];
  attachments: AdmMeetingAttachment[];
  recordedBy: string;
}

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

  userId?: string;
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
    invitees?: AdmMeetingInvitee[];
    attachments?: AdmMeetingAttachment[];
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
