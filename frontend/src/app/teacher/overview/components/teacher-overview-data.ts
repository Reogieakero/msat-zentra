export interface TeacherClassRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  schedule: string;
  studentCount: number;
}

export interface TeacherKpiRow {
  classCount: number;
  pendingAssessments: number;
  openFlags: number;
}

export interface TeacherActivityRow {
  action: string;
  target: string;
  when: string;
}

export interface AdvisoryStatusRow {
  studentId: string;
  name: string;
  section: string;
  riskLevel: "Low" | "Moderate" | "High";
  flag: "academic" | "attendance" | "behavioral" | "none";
}

export interface AdvisoryAttendanceRow {
  date: string;
  session: "AM" | "PM";
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AdvisoryReferralRow {
  id: string;
  studentName: string;
  targetRole: "Guidance Counselor" | "School Nurse" | "ADM Coordinator";
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
}

export interface AdvisoryAdmRow {
  studentName: string;
  stage: "referral" | "parent_meeting" | "home_visit" | "recommendation" | "principal_approval" | "modules" | "completion";
  updatedAt: string;
}

export interface TeacherOverviewData {
  classes: TeacherClassRow[];
  kpi: TeacherKpiRow;
  recentActivity: TeacherActivityRow[];
  advisory: {
    students: AdvisoryStatusRow[];
    attendance: AdvisoryAttendanceRow[];
    referrals: AdvisoryReferralRow[];
    admCases: AdvisoryAdmRow[];
  };
}

export const MOCK_TEACHER_OVERVIEW: TeacherOverviewData = {
  classes: [
    { id: "c1", subject: "Math 7", gradeLevel: "Grade 7", section: "Grade 7-A", schedule: "Mon / Wed / Fri · 08:00–08:45", studentCount: 20 },
    { id: "c2", subject: "Math 7", gradeLevel: "Grade 7", section: "Grade 7-B", schedule: "Tue / Thu · 10:00–10:45", studentCount: 19 },
    { id: "c3", subject: "Gen Math 11", gradeLevel: "Grade 11", section: "Grade 11-A", schedule: "Mon / Wed / Fri · 13:00–13:45", studentCount: 22 },
  ],
  kpi: {
    classCount: 3,
    pendingAssessments: 2,
    openFlags: 1,
  },
  recentActivity: [
    { action: "Locked grades", target: "Math 7 · Grade 7-A", when: "2h ago" },
    { action: "Raised flag", target: "Juan Dela Cruz · Gen Math 11", when: "5h ago" },
    { action: "Entered scores", target: "Performance Task 3 · Grade 7-B", when: "1d ago" },
  ],
  advisory: {
    students: [
      { studentId: "s1", name: "Maria Santos", section: "Grade 7-A", riskLevel: "Low", flag: "none" },
      { studentId: "s2", name: "Juan Reyes", section: "Grade 7-A", riskLevel: "Moderate", flag: "attendance" },
      { studentId: "s3", name: "Ana Cruz", section: "Grade 7-A", riskLevel: "High", flag: "behavioral" },
      { studentId: "s4", name: "Pedro Garcia", section: "Grade 7-A", riskLevel: "Low", flag: "academic" },
      { studentId: "s5", name: "Sofia Mendoza", section: "Grade 7-A", riskLevel: "Moderate", flag: "attendance" },
    ],
    attendance: [
      { date: "2026-09-01", session: "AM", present: 18, absent: 1, late: 1, excused: 0 },
      { date: "2026-09-01", session: "PM", present: 19, absent: 0, late: 1, excused: 0 },
      { date: "2026-08-29", session: "AM", present: 17, absent: 2, late: 1, excused: 0 },
    ],
    referrals: [
      { id: "ref1", studentName: "Ana Cruz", targetRole: "Guidance Counselor", status: "pending", createdAt: "2026-09-02" },
      { id: "ref2", studentName: "Pedro Garcia", targetRole: "School Nurse", status: "in_progress", createdAt: "2026-08-28" },
    ],
    admCases: [
      { studentName: "Juan Reyes", stage: "parent_meeting", updatedAt: "2026-09-01" },
      { studentName: "Sofia Mendoza", stage: "home_visit", updatedAt: "2026-08-30" },
    ],
  },
};

export async function fetchTeacherOverview(): Promise<TeacherOverviewData> {
  return Promise.resolve(MOCK_TEACHER_OVERVIEW);
}