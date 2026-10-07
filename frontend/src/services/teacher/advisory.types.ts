// Shared shapes for the teacher advisory desk (advisee roster + detail).
// Pure types only. Note: `AdvisorySectionInfo` duplicates the identical
// shape in overview.types (same backend section projection, defined per
// desk) — pre-existing, kept local to avoid cross-service coupling.
// (`humanize`/`initialsOf` previously duplicated here now live in lib/utils.)
export type AdviseeRiskLevel = "Low" | "Moderate" | "High";
export type AdviseeRiskFlag = "academic" | "attendance" | "behavioral";
export type DrawerSection = "grades" | "attendance" | "anecdotal";

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface AdviseeSubjectGrade {
  subject: string;
  code: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
}

export interface AdviseeLiveGrade {
  subject: string;
  code: string;
  /** Live unweighted mean of recorded percentage scores — realtime,
   *  regardless of lock / finalization status. */
  average: number;
}

export interface AdviseeRow {
  studentId: string;
  name: string;
  lrn: string;
  birthdate: string | null;
  gender: string | null;
  section: string;
  riskLevel: AdviseeRiskLevel;
  flags: AdviseeRiskFlag[];
  attendanceRate: number;
  anecdotalCount: number;
  confidentialityTiers: string[];
  hasOpenFlag: boolean;
  openFlagCount: number;
  hasAccount: boolean;
  grades: AdviseeSubjectGrade[];
  liveGrades: AdviseeLiveGrade[];
}

export interface AdvisoryRosterSubject {
  name: string;
  code: string;
}

export interface AdvisoryRoster {
  advisorySections: AdvisorySectionInfo[];
  termId: string | null;
  students: AdviseeRow[];
  subjects: AdvisoryRosterSubject[];
}

export interface AdviseeGrade {
  subject: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string;
}

export interface AdviseeReferral {
  id: string;
  target: string;
  status: string;
}

export interface AdviseeAdmCase {
  id: string;
  stage: string;
  eligibility: string;
}

export interface AdviseeGradeFlag {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  subject: string;
  raisedBy: string;
  createdAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface AdviseeDetail {
  studentId: string;
  name: string;
  lrn: string;
  birthdate: string | null;
  gender: string | null;
  section: string;
  gradeLevel: string;
  grades: AdviseeGrade[];
  attendance: {
    rate: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  anecdotal: {
    count: number;
    tiers: string[];
    categories: string[];
  };
  referrals: AdviseeReferral[];
  admCases: AdviseeAdmCase[];
  gradeFlags: AdviseeGradeFlag[];
}
