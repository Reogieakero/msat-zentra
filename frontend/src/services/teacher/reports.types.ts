export interface TeacherReportTerm {
  id: string;
  termNumber: number;
  startDate: string | null;
  endDate: string | null;
  schoolYearName: string | null;
}

export type FinalsLockStatus = "unlocked" | "locked" | "adviser_approved";

export interface TeacherReportClassRow {
  id: string;
  subjectId: string;
  subject: string;
  subjectCode: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  /** The signed-in teacher's role in this section. */
  teacherRole: "adviser" | "subject_teacher";
  learners: number;
  assessments: number;
  gradedAssessments: number;
  completionRate: number | null;
  average: number | null;
  transmutedAverage: number | null;
  graded: number;
  passing: number;
  failing: number;
  passRate: number | null;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceLate: number;
  attendanceExcused: number;
  attendanceTotal: number;
  attendanceRate: number | null;
  belowAttendance: number;
  lockStatus: FinalsLockStatus | null;
}

export interface TeacherReportPendingRow {
  id: string;
  subject: string;
  section: string;
  title: string;
  type: "WW" | "PT" | "E";
  dateGiven: string;
  scored: number;
  learners: number;
}

export type RiskFlag = "academic" | "attendance" | "behavioral";

export interface TeacherReportAtRiskRow {
  studentId: string;
  name: string;
  section: string;
  riskLevel: "Low" | "Moderate" | "High";
  flags: RiskFlag[];
  average: number | null;
  attendanceRate: number | null;
}

export interface TeacherReportsPayload {
  term: TeacherReportTerm | null;
  teacher: {
    name: string;
    code: string | null;
    isAdviser: boolean;
    isMasterTeacher: boolean;
    advisorySection: { id: string; name: string; gradeLevel: string } | null;
  };
  summary: {
    classes: number;
    learners: number;
    assessments: number;
    gradedAssessments: number;
    average: number | null;
    transmutedAverage: number | null;
    passing: number;
    failing: number;
    passRate: number | null;
    attendancePresent: number;
    attendanceTotal: number;
    attendanceRate: number | null;
    atRisk: number;
    highRisk: number;
    openFlags: number;
    anecdotal: number;
    referrals: number;
  };
  classes: TeacherReportClassRow[];
  distribution: { band: string; label: string; count: number; percent: number }[];
  atRisk: TeacherReportAtRiskRow[];
  pending: TeacherReportPendingRow[];
  activity: {
    anecdotal: number;
    referrals: { total: number; byStatus: { status: string; count: number }[] };
  };
  generatedAt: string;
}

export interface TeachingLoadSlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}
