// Shared shapes for the teacher attendance sheets. Pure types only.
// NOTE: legacy AM/PM takes are archived (GET /api/attendance/legacy/days).
// New takes are keyed by (subjectId, slot) — no session type remains here.
export type SheetStatus = "present" | "absent" | "late" | "excused";

export interface OfferedSubject {
  assignmentId: string;
  subjectId: string;
  code: string;
  name: string;
  gradeLevel: string;
  teacherId: string;
  teacherName: string;
  canMark: boolean;
}

export interface SheetStudent {
  studentId: string;
  name: string;
  lrn: string;
  attendanceRate: number;
}

export interface SheetContext {
  sectionId: string;
  sectionName: string;
  termId: string;
  students: SheetStudent[];
}

/** Term-scoped per-day subject marks for the meetup blocks view. */
export interface SubjectDayRecord {
  key: string;
  date: string; // UTC day key
  status: SheetStatus;
}

export interface SubjectDays {
  sectionId: string;
  subjectId: string;
  termId: string;
  termStart: string | null;
  termEnd: string | null;
  records: SubjectDayRecord[];
}

/** Roster for one section the caller may serve (advisory, assignments, or
 *  code-linked timetable slots) — drives code-claimed per-subject sheets. */
export interface SectionRoster {
  sectionId: string;
  sectionName: string;
  termId: string;
  students: SheetStudent[];
}

export interface SubmitSheetPayload {
  sectionId: string;
  termId: string;
  date: string;
  subjectId: string;
  assignmentId?: string;
  slot: number;
  records: { studentId: string; status: SheetStatus }[];
}
