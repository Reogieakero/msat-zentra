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
  ownerTeacherId?: string;
  ownerTeacherName?: string;
  isMine?: boolean;
  myAssignmentId?: string | null;
  takenByOther?: boolean;
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

export interface SubjectDayRecord {
  key: string;
  date: string;
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
