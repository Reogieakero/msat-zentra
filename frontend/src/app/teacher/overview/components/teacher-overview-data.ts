import { apiClient } from "@/lib/api/client";

export interface TeacherClassRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  studentCount: number;
}

export interface TeacherKpiRow {
  classCount: number;
  pendingAssessments: number;
  openFlags: number;
  studentCount: number;
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
  flags: ("academic" | "attendance" | "behavioral")[];
}

export interface SubjectAssessmentRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  type: "WW" | "PT" | "QE";
  title: string;
  dueDate: string;
  status: string;
}

export interface ClassAverageRow {
  subject: string;
  gradeLevel: string;
  section: string;
  average: number;
  assessed: number;
  students: number;
}

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface TeacherOverviewData {
  teacherName: string;
  isAdviser: boolean;
  advisorySection: AdvisorySectionInfo | null;
  kpi: TeacherKpiRow;
  atRiskFactors: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  classes: TeacherClassRow[];
  recentActivity: TeacherActivityRow[];
  advisory: {
    students: AdvisoryStatusRow[];
  };
  subjectClasses: {
    assessments: SubjectAssessmentRow[];
    standings: ClassAverageRow[];
  };
}

export async function fetchTeacherOverview(): Promise<TeacherOverviewData> {
  const { data } = await apiClient.get<TeacherOverviewData>("/api/teacher/overview");
  return data;
}
