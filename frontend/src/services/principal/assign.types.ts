// Principal assigning shapes — school-wide (G7–G12). Pure types only.
// Mirrors the registrar assign shapes but targets the principal-scoped
// /api/academics/assign/* routes (requireRole("principal")).
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
  /** Free-text advisory listing — shown when no teacher account is linked. */
  adviserLabel: string;
  /** Advisory claim code (principal-only). Teacher enters this to claim the seat. */
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
  /** Freshly minted claim code — share with the listed teacher out-of-band. */
  adviserCode: string;
}

export interface AdviserBatchInput {
  /** Known record ids (fast path) — omitted when resolving by typed name. */
  sectionId?: string;
  sectionName?: string;
  gradeLevel?: GradeLevel;
  adviserId?: string | null;
  adviserName?: string;
}

/** One modal row: raw typed values. The mutation resolves ids, auto-creates
    missing sections, then assigns — all in one flow. */
export interface AdvisoryEntryInput {
  sectionName: string;
  gradeLevel: GradeLevel;
  adviserName: string;
}
