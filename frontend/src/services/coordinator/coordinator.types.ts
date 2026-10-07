// Shared shapes for the ADM Coordinator desk. Pure types only — no runtime
// imports, so UI files can `import type` without pulling in fetch logic.
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
    /** Invited staff user ids — prefills the reschedule picker so editing
        time/venue never wipes the invite list. */
    inviteeIds?: string[];
  } | null;
  /* Guidance/nurse hand-off timestamp (full ISO) on early referral rows —
     the moment the referral to the ADM Coordinator was created. Waiting-time
     readouts run from here, not from the anecdotal observation date. */
  endorsedAt?: string | null;
  /** Consultation reviewer on early referral rows (nurse | guidance_counselor | lrpc | null when direct). */
  consultReviewer?: string | null;
  /** Referral-level status on early referral rows (pending | in_progress | …). */
  referralStatus?: string;
  /** Latest audit action across the case (referral + profile + meetings),
      served per row by /referrals/all for the Latest action column. */
  lastActionAt?: string | null;
  lastActionType?: string | null;
  /* Module pass-tracking (from /referrals/all on profile rows) — submitted
     vs released ADM modules. Early (pre-profile) rows carry 0/0. Optional
     so older cached pages without the field still type-check. */
  modulesSubmitted?: number;
  modulesTotal?: number;
}

/* Action-derived ADM case status — what the case actually needs now,
   computed from the backend pipeline (ADM_STAGE_FLOW in
   backend/src/services/adm.ts) instead of showing the raw stage enum.
   Same idea as the nurse queue's deriveActionStatus. */
export interface AdmCaseStatus {
  key: string;
  label: string;
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
  /** Filtered pager count is `total`; tile stats stay UNFILTERED. */
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
  /* Devices ever issued to this learner profile (GET /api/adm/approvals
     serves devicesIssued per row). 0 = principal-approved with no device
     yet — the devices page uses this for its needs-device list. Optional
     so older cached pages without the field still type-check. */
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
  /** Present when the ledger was read with `page + pageSize` pagination. */
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

/* Staff invited to a parent meeting at booking time (guidance / nurse /
   adviser accounts) — separate from `attendees` (free-text people present,
   recorded with the outcome). */
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
  /** Present when the entry came from the invitee checklist (booking-time
      invite), linking attendance back to the invited staff account. */
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
