import { apiClient } from "@/lib/api/client";
import type { Assignment, Section, Subject, SubjectCategory, Teacher } from "./data";

import { isCancel, type AxiosError } from "axios";

// When the caller's AbortSignal fires, axios rejects with a CanceledError. We
// convert that into a promise that never settles so callers (and the page's
// error handler) never see a spurious "canceled" error on unmount / refetch.
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

export interface SubjectsResponse {
  subjects: Subject[];
}

export interface SectionsResponse {
  sections: Section[];
}

export interface TeachersResponse {
  teachers: Teacher[];
}

export interface SchoolYearOption {
  id: string;
  name: string;
  isActive: boolean;
}

export async function fetchSchoolYears(signal?: AbortSignal): Promise<SchoolYearOption[]> {
  const res = await withAbort(
    apiClient.get<{ schoolYears: SchoolYearOption[] }>("/api/registrar/academics/school-years", {
      signal,
    }),
    signal,
  );
  return res.data.schoolYears;
}

export async function fetchSubjects(signal?: AbortSignal): Promise<Subject[]> {
  const res = await withAbort(
    apiClient.get<SubjectsResponse>("/api/registrar/academics/subjects", { signal }),
    signal,
  );
  return res.data.subjects;
}

export async function createSubject(input: {
  code: string;
  name: string;
  gradeLevel: 11 | 12;
  category?: SubjectCategory;
}): Promise<Subject> {
  const res = await apiClient.post<Subject>("/api/registrar/academics/subjects", input);
  return res.data;
}

export async function updateSubject(
  id: string,
  input: { name?: string; category?: SubjectCategory },
): Promise<Subject> {
  const res = await apiClient.patch<Subject>(`/api/registrar/academics/subjects/${id}`, input);
  return res.data;
}

export async function fetchSections(signal?: AbortSignal, schoolYearId?: string): Promise<Section[]> {
  const res = await withAbort(
    apiClient.get<SectionsResponse>("/api/registrar/academics/sections", {
      signal,
      params: schoolYearId ? { schoolYearId } : undefined,
    }),
    signal,
  );
  return res.data.sections;
}

export interface TermOption {
  id: string;
  termNumber: number;
}

export async function fetchTerms(schoolYearId?: string, signal?: AbortSignal): Promise<TermOption[]> {
  const res = await withAbort(
    apiClient.get<{ schoolYearId: string | null; terms: TermOption[] }>(
      "/api/registrar/academics/terms",
      { signal, params: schoolYearId ? { schoolYearId } : undefined },
    ),
    signal,
  );
  return res.data.terms;
}

export async function createSection(input: {
  name: string;
  gradeLevel: 11 | 12;
  schoolYear?: string;
  adviserId?: string;
}): Promise<Section> {
  const res = await apiClient.post<Section>("/api/registrar/academics/sections", input);
  return res.data;
}

export async function updateSection(
  id: string,
  input: { name?: string; adviserId?: string },
): Promise<Section> {
  const res = await apiClient.patch<Section>(`/api/registrar/academics/sections/${id}`, input);
  return res.data;
}

export async function fetchTeachers(signal?: AbortSignal): Promise<Teacher[]> {
  const res = await withAbort(
    apiClient.get<TeachersResponse>("/api/registrar/academics/teachers", { signal }),
    signal,
  );
  return res.data.teachers;
}

export interface TeacherLoad {
  subjectId: string;
  code: string;
  name: string;
  gradeLevel: 11 | 12;
  sections: string[];
  terms: number[];
}

export interface TeacherWithLoads {
  id: string;
  name: string;
  loads: TeacherLoad[];
}

export async function fetchTeachersWithLoads(signal?: AbortSignal): Promise<TeacherWithLoads[]> {
  const res = await withAbort(
    apiClient.get<{ teachers: TeacherWithLoads[] }>("/api/registrar/academics/teachers", { signal }),
    signal,
  );
  return res.data.teachers;
}

export interface TeacherAssignment {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  gradeLevel: 11 | 12;
  section: string;
  sectionId: string;
  term: number;
}

export interface TeacherAdviser {
  id: string;
  name: string;
  gradeLevel: 11 | 12;
}

export interface TeacherDetail {
  id: string;
  name: string;
  adviser: TeacherAdviser[];
  assignments: TeacherAssignment[];
}

export async function fetchTeacher(
  id: string,
  signal?: AbortSignal,
): Promise<{ teacher: TeacherDetail }> {
  const res = await withAbort(
    apiClient.get<{ teacher: TeacherDetail }>(`/api/registrar/academics/teachers/${id}`, { signal }),
    signal,
  );
  return res.data;
}

export async function assignTeacher(input: {
  sectionId: string;
  subjectId: string;
  teacherId: string;
  term: string;
}): Promise<Assignment> {
  const res = await apiClient.post<Assignment>("/api/registrar/academics/assignments", input);
  return res.data;
}

export async function removeAssignment(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    `/api/registrar/academics/assignments/${id}`,
  );
  return res.data;
}

export interface SubjectStudent {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: 11 | 12;
  section: string;
  finalGrade: number;
  remarks: "Passed" | "Failed" | "No grade yet";
  status: "active" | "pending" | "suspended";
  hasAccount: boolean;
}

export interface SubjectStudentsResponse {
  subject: { id: string; code: string; name: string; gradeLevel: 11 | 12; category: SubjectCategory };
  students: SubjectStudent[];
}

export async function fetchSubjectStudents(
  id: string,
  signal?: AbortSignal,
): Promise<SubjectStudentsResponse> {
  const res = await withAbort(
    apiClient.get<SubjectStudentsResponse>(
      `/api/registrar/academics/subjects/${id}/students`,
      { signal },
    ),
    signal,
  );
  return res.data;
}

export interface SectionEnrollment {
  id: string;
  name: string;
  count: number;
}

export interface SubjectOverview {
  id: string;
  code: string;
  name: string;
  gradeLevel: 11 | 12;
  category: SubjectCategory;
  active: boolean;
  enrolled: number;
  enrollments: SectionEnrollment[];
}

export interface AcademicsOverview {
  schoolYear: string | null;
  schoolYearId: string | null;
  term: number | null;
  subjects: SubjectOverview[];
}

export async function fetchAcademicsOverview(
  signal?: AbortSignal,
): Promise<AcademicsOverview> {
  const res = await withAbort(
    apiClient.get<AcademicsOverview>("/api/registrar/academics/overview", { signal }),
    signal,
  );
  return res.data;
}
