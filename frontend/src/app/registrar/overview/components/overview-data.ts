import { apiClient } from "@/lib/api/client";

export interface RegistrarAttachmentRow {
  student: string;
  lrn: string;
  grade: string;
  when: string;
}

export interface RegistrarMissingSf10Row {
  student: string;
  lrn: string;
  grade: string;
  section: string;
}

export interface RegistrarPendingStudentRow {
  name: string;
  lrn: string;
  grade: string;
  parent: string;
}

export interface RegistrarSf10StudentRow {
  name: string;
  lrn: string;
  grade: string;
}

export interface RegistrarGradeCountRow {
  grade: string;
  count: number;
}

export interface RegistrarOverviewData {
  pendingAccounts: number;
  pendingAdviserAccess: number;
  lockedFinalsAwaiting: number;
  sf10Released: number;
  sections: number;
  subjects: number;
  reportCards: number;
  latestAttachments: RegistrarAttachmentRow[];
  missingSf10: RegistrarMissingSf10Row[];
  pendingStudents: RegistrarPendingStudentRow[];
  sf10Students: RegistrarSf10StudentRow[];
  finals: { total: number; finalized: number; awaiting: number; draft: number };
  sf10: { total: number; released: number; available: number; attach: number };
  sectionsByGrade: RegistrarGradeCountRow[];
  subjectsByGrade: RegistrarGradeCountRow[];
}

export async function fetchRegistrarOverview(): Promise<RegistrarOverviewData> {
  const { data } = await apiClient.get<RegistrarOverviewData>("/api/registrar/overview");
  return data;
}