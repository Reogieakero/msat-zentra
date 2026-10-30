export interface StudentListRow {
  studentId: string;
  name: string;
  lrn: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
  hasAccount: boolean;

  attendancePresent: number;

  attendanceTotal: number;

  attendancePercentage: number | null;
  computedAverage: number | null;

  academicGrade: number | null;

  /** Anecdotal records filed for this learner in the active term. */
  anecdotalCount: number;
}

export interface StudentListClass {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
}

export interface StudentListClassItem {
  id: string;
  subject: string;

  code: string;
  gradeLevel: string;
  section: string;
  studentCount: number;
}

export interface AdvisorySectionItem {
  id: string;
  name: string;
  gradeLevel: string;
  studentCount: number;
}

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface ClassPick {
  kind: "class" | "advisory";
  id: string;
}

export interface StudentListResponse {

  classes: StudentListClassItem[];

  advisorySections: AdvisorySectionItem[];
  class: StudentListClass | null;
  advisorySection: AdvisorySectionInfo | null;
  anecdotalVisible: boolean;
  students: StudentListRow[];
}
