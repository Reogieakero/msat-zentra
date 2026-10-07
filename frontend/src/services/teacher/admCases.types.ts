// Advisory ADM-case shapes. Pure types only.
/** One ADM case for an advisory student — status-only, never clinical detail. */
export interface AdmCase {
  id: string;
  studentId: string;
  studentName: string;
  lrn: string;
  gradeLevel: string;
  section: string;
  photoUrl: string | null;
  referralId: string;
  // Pending or ongoing only — the API never serves dismissed (cancelled)
  // cases here; those live on the teacher's referrals table.
  referralStatus: "pending" | "in_progress" | "resolved";
  consultReviewer?: string | null;
  stage: string;
  stageLabel: string;
  eligibilityStatus: "pending" | "eligible" | "ineligible";
  approved: boolean;
  approvedAt: string | null;
  datePrepared: string | null;
  meetingAttended: boolean | null;
  lastMeetingAt?: string | null;
  hasHomeVisit: boolean;
  modulesSubmitted: number;
  modulesTotal: number;
  lastModuleAt?: string | null;
  devicesIssued: number;
  devicesReturned: number;
  certificationIssued: boolean;
  certificationAt?: string | null;
  timeline?: {
    label: string;
    detail?: string | null;
    date: string;
    at: string;
    action: string;
    byRole: string | null;
    source: "referrals" | "counseling_sessions" | "adm_parent_meetings" | "case";
    stage?: string | null;
    homeVisit?: boolean;
  }[];
}

export interface MyAdmCasesPage {
  cases: AdmCase[];
  total: number;
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}
