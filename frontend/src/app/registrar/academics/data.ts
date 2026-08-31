export type GradeLevel = 11 | 12;

export type Subject = {
  id: string;
  code: string;
  name: string;
  gradeLevel: GradeLevel;
  active: boolean;
  enrolled: number;
  passed: number;
  failed: number;
};

export type Teacher = {
  id: string;
  name: string;
};

export type Assignment = {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  term: string;
};

export type Section = {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  schoolYear: string;
  adviserId: string;
  adviserName: string;
  assignments: Assignment[];
};

export type StudentStatus = "active" | "pending" | "suspended";

export type Student = {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: GradeLevel;
  section: string;
  finalGrade: number;
  remarks: "Passed" | "Failed";
  status: StudentStatus;
};

export const SCHOOL_YEARS = ["2026–2027", "2025–2026", "2024–2025"] as const;
export const ACTIVE_SCHOOL_YEAR = "2026–2027";
export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
