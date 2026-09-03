import { apiClient } from "@/lib/api/client";

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

export interface TeacherOverviewData {
  classes: TeacherClassRow[];
  kpi: TeacherKpiRow;
  recentActivity: TeacherActivityRow[];
}

export async function fetchTeacherOverview(): Promise<TeacherOverviewData> {
  const { data } = await apiClient.get<TeacherOverviewData>("/api/teacher/overview");
  return data;
}