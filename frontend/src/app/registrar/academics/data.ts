export type GradeLevel = 11 | 12;

export type SubjectCategory = "Core" | "Elective";

export const SUBJECT_CATEGORIES: SubjectCategory[] = ["Core", "Elective"];

export type Subject = {
  id: string;
  code: string;
  name: string;
  gradeLevel: GradeLevel;
  category: SubjectCategory;
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
  schoolYearId: string;
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

// Labels must match the backend `SchoolYear.name` format ("SY 2026-2027").
// The old values used an en dash without the "SY " prefix, which never matched
// any stored row and forced the API to fall back to (or fail on) the active year.
// School-year options come from the database (GET …/academics/school-years).
// Nothing here is hardcoded: the dialog falls back to the section's year,
// then the active year, then the first available year.
export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
