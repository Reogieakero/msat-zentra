import { apiClient } from "@/lib/api/client";

export interface RecordKeeperAttachmentRow {
  student: string;
  lrn: string;
  grade: string;
  when: string;
}

export interface RecordKeeperMissingSf10Row {
  student: string;
  lrn: string;
  grade: string;
  section: string;
}

export interface RecordKeeperPendingStudentRow {
  name: string;
  lrn: string;
  grade: string;
  parent: string;
}

export interface RecordKeeperSf10StudentRow {
  name: string;
  lrn: string;
  grade: string;
}

export interface RecordKeeperGradeCountRow {
  grade: string;
  count: number;
}

export interface RecordKeeperOverviewData {
  pendingAccounts: number;
  pendingAdviserAccess: number;
  lockedFinalsAwaiting: number;
  sf10Released: number;
  sections: number;
  subjects: number;
  reportCards: number;
  latestAttachments: RecordKeeperAttachmentRow[];
  missingSf10: RecordKeeperMissingSf10Row[];
  pendingStudents: RecordKeeperPendingStudentRow[];
  sf10Students: RecordKeeperSf10StudentRow[];
  finals: { total: number; finalized: number; awaiting: number; draft: number };
  sf10: { total: number; released: number; available: number; attach: number };
  sectionsByGrade: RecordKeeperGradeCountRow[];
  subjectsByGrade: RecordKeeperGradeCountRow[];
}

export async function fetchRecordKeeperOverview(): Promise<RecordKeeperOverviewData> {
  const { data } = await apiClient.get<RecordKeeperOverviewData>("/api/registrar/overview");
  return data;
}