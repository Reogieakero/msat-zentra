import { apiClient } from "@/lib/api/client";
import type { AxiosError } from "axios";
import { isCancel } from "axios";

// Principal assigning client — school-wide (G7–G12).
// Mirrors the registrar assign client but targets the principal-scoped
// /api/academics/assign/* routes (requireRole("principal")).

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      // never resolve/reject — let the in-flight request die silently
    };
    if (signal.aborted) return;
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then(
        (v) => {
          signal.removeEventListener("abort", onAbort);
          resolve(v);
        },
        (err: AxiosError) => {
          signal.removeEventListener("abort", onAbort);
          if (isCancel(err)) return; // swallow cancel
          reject(err);
        },
      )
      .catch(() => {
        /* unreachable, kept for clarity */
      });
  });
}

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

export async function fetchSchoolYears(signal?: AbortSignal): Promise<SchoolYearOption[]> {
  const res = await withAbort(
    apiClient.get<{ schoolYears: SchoolYearOption[] }>("/api/academics/assign/school-years", {
      signal,
    }),
    signal,
  );
  return res.data.schoolYears;
}

export async function fetchSubjects(signal?: AbortSignal): Promise<Subject[]> {
  const res = await withAbort(
    apiClient.get<{ subjects: Subject[] }>("/api/academics/assign/subjects", { signal }),
    signal,
  );
  return res.data.subjects;
}

export async function fetchSections(
  signal?: AbortSignal,
  schoolYearId?: string,
): Promise<Section[]> {
  const res = await withAbort(
    apiClient.get<{ sections: Section[] }>("/api/academics/assign/sections", {
      signal,
      params: schoolYearId ? { schoolYearId } : undefined,
    }),
    signal,
  );
  return res.data.sections;
}

export async function fetchTeachers(signal?: AbortSignal): Promise<Teacher[]> {
  const res = await withAbort(
    apiClient.get<{ teachers: Teacher[] }>("/api/academics/assign/teachers", { signal }),
    signal,
  );
  return res.data.teachers;
}

export async function fetchTerms(
  schoolYearId?: string,
  signal?: AbortSignal,
): Promise<TermOption[]> {
  const res = await withAbort(
    apiClient.get<{ schoolYearId: string | null; terms: TermOption[] }>(
      "/api/academics/assign/terms",
      { signal, params: schoolYearId ? { schoolYearId } : undefined },
    ),
    signal,
  );
  return res.data.terms;
}

export async function assignTeacher(input: {
  sectionId: string;
  subjectId: string;
  teacherId: string;
  term: string;
}): Promise<Assignment> {
  const res = await apiClient.post<Assignment>("/api/academics/assign/assignments", input);
  return res.data;
}

export async function removeAssignment(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    `/api/academics/assign/assignments/${id}`,
  );
  return res.data;
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
}

// Principal advisory — assign (or clear with null/empty) the section adviser.
export async function assignAdviser(
  sectionId: string,
  adviserId: string | null,
): Promise<SectionAdviserResult> {
  const res = await apiClient.patch<SectionAdviserResult>(
    `/api/academics/assign/sections/${sectionId}/adviser`,
    { adviserId },
  );
  return res.data;
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

// Atomic batch: ONE request assigns every row (all-or-nothing transaction
// server-side). Rows may carry ids (when the client already knows the record)
// or typed names + grade — the server resolves names against the database,
// so a stale/empty client cache can never cause a false "not found".
export async function assignAdvisersBatch(
  assignments: AdviserBatchInput[],
): Promise<SectionAdviserResult[]> {
  const res = await apiClient.patch<{ updated: SectionAdviserResult[] }>(
    "/api/academics/assign/sections/advisers",
    { assignments },
  );
  return res.data.updated;
}

// Principal section deletion — hard delete guarded server-side: sections with
// linked students, roster entries, assignments, or records are rejected.
export async function deleteSection(sectionId: string): Promise<{ id: string; deleted: boolean }> {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    `/api/academics/assign/sections/${sectionId}`,
  );
  return res.data;
}

// Principal section creation — the principal (not the registrar) owns this
// step. Filed under the active school year automatically.
export async function createSection(input: {
  name: string;
  gradeLevel: GradeLevel;
}): Promise<Section> {
  const res = await apiClient.post<Section>("/api/academics/assign/sections", input);
  return res.data;
}
