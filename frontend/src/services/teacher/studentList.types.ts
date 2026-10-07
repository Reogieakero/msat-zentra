// Roster shapes for the teacher students page. Pure types only. Note:
// `AdvisorySectionInfo` duplicates the identical backend section
// projection defined in overview.types / advisory.types (pre-existing,
// kept local to avoid cross-service coupling).
export interface StudentListRow {
  studentId: string;
  name: string;
  lrn: string;
  hasAccount: boolean;
  /** Present elapsed meetups for this subject (worst-status-wins per day). */
  attendancePresent: number;
  /** Elapsed meetup dates for this subject × section × term (the sheet's denominator). */
  attendanceTotal: number;
  /** Attendance-sheet basis: present elapsed meetups ÷ elapsed meetups.
   *  Elapsed meetups with no take count as absent (0%, never blank);
   *  null only when nothing has elapsed yet. */
  attendancePercentage: number | null;
  computedAverage: number | null;
  /** Transmuted grade for this specific subject + term. Null when not yet encoded. */
  academicGrade: number | null;
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
  /** Subject code (e.g. AP, ESP) — shown as the rail label. */
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

/** Rail pick: a handled subject × section, or an advised section. */
export interface ClassPick {
  kind: "class" | "advisory";
  id: string;
}

export interface StudentListResponse {
  /** Handled subject × section rail — same shape as the overview `classes`. */
  classes: StudentListClassItem[];
  /** Advised-section rail — empty for regular teachers. */
  advisorySections: AdvisorySectionItem[];
  class: StudentListClass | null;
  advisorySection: AdvisorySectionInfo | null;
  students: StudentListRow[];
}
