export interface RegistryAttachmentRow {
  student: string;
  lrn: string;
  grade: string;
  when: string;
}

export interface RegistryMissingSf10Row {
  student: string;
  lrn: string;
  grade: string;
  section: string;
}

export interface RegistryPendingStudentRow {
  name: string;
  lrn: string;
  grade: string;
  parent: string;
}

export interface RegistrySf10StudentRow {
  name: string;
  lrn: string;
  grade: string;
}

export interface RegistryGradeCountRow {
  grade: string;
  count: number;
}

export interface RegistryOverviewData {
  pendingAccounts: number;
  pendingAdviserAccess: number;
  lockedFinalsAwaiting: number;
  sf10Released: number;
  sections: number;
  subjects: number;
  reportCards: number;
  latestAttachments: RegistryAttachmentRow[];
  missingSf10: RegistryMissingSf10Row[];
  pendingStudents: RegistryPendingStudentRow[];
  sf10Students: RegistrySf10StudentRow[];
  finals: { total: number; finalized: number; awaiting: number; draft: number };
  sf10: { total: number; released: number; available: number; attach: number };
  sectionsByGrade: RegistryGradeCountRow[];
  subjectsByGrade: RegistryGradeCountRow[];
}

export type RegistrarAttachmentRow = RegistryAttachmentRow;
export type RegistrarMissingSf10Row = RegistryMissingSf10Row;
export type RegistrarPendingStudentRow = RegistryPendingStudentRow;
export type RegistrarSf10StudentRow = RegistrySf10StudentRow;
export type RegistrarGradeCountRow = RegistryGradeCountRow;
export type RegistrarOverviewData = RegistryOverviewData;

export type RecordKeeperAttachmentRow = RegistryAttachmentRow;
export type RecordKeeperMissingSf10Row = RegistryMissingSf10Row;
export type RecordKeeperPendingStudentRow = RegistryPendingStudentRow;
export type RecordKeeperSf10StudentRow = RegistrySf10StudentRow;
export type RecordKeeperGradeCountRow = RegistryGradeCountRow;
export type RecordKeeperOverviewData = RegistryOverviewData;
