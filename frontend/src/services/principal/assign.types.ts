export type GradeLevel = 7 | 8 | 9 | 10 | 11 | 12;

export interface Assignment {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  term: string;
}

export interface Section {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  schoolYear: string;
  schoolYearId: string;
  adviserId: string;
  adviserName: string;

  adviserLabel: string;

  adviserCode: string;
  assignments: Assignment[];
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  gradeLevel: GradeLevel;
  category: string;
  active: boolean;
}

export interface Teacher {
  id: string;
  name: string;
}

export interface SchoolYearOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface TermOption {
  id: string;
  termNumber: number;
}

export interface SectionAdviserResult {
  id: string;
  name: string;
  gradeLevel: GradeLevel;
  schoolYear: string;
  schoolYearId: string;
  adviserId: string;
  adviserName: string;
  adviserLabel: string;

  adviserCode: string;
}

export interface AdviserBatchInput {

  sectionId?: string;
  sectionName?: string;
  gradeLevel?: GradeLevel;
  adviserId?: string | null;
  adviserName?: string;
}

export interface AdvisoryEntryInput {
  sectionName: string;
  gradeLevel: GradeLevel;
  adviserName: string;
}
