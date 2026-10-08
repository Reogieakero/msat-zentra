import { apiClient } from "@/lib/api/client";
import type { AxiosError } from "axios";
import { isCancel } from "axios";
import type {
  AdviserBatchInput,
  Assignment,
  GradeLevel,
  SchoolYearOption,
  Section,
  SectionAdviserResult,
  Subject,
  Teacher,
  TermOption,
} from "./assign.types";

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {

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
          if (isCancel(err)) return;
          reject(err);
        },
      )
      .catch(() => {

      });
  });
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

export async function assignAdviser(
  sectionId: string,
  adviserId: string | null,
  adviserName?: string | null,
): Promise<SectionAdviserResult> {
  const res = await apiClient.patch<SectionAdviserResult>(
    `/api/academics/assign/sections/${sectionId}/adviser`,
    { adviserId, adviserName },
  );
  return res.data;
}

export async function regenerateAdviserCode(sectionId: string): Promise<SectionAdviserResult> {
  const res = await apiClient.post<SectionAdviserResult>(
    `/api/academics/assign/sections/${sectionId}/adviser-code/regenerate`,
  );
  return res.data;
}

export async function assignAdvisersBatch(
  assignments: AdviserBatchInput[],
): Promise<SectionAdviserResult[]> {
  const res = await apiClient.patch<{ updated: SectionAdviserResult[] }>(
    "/api/academics/assign/sections/advisers",
    { assignments },
  );
  return res.data.updated;
}

export async function deleteSection(sectionId: string): Promise<{ id: string; deleted: boolean }> {
  const res = await apiClient.delete<{ id: string; deleted: boolean }>(
    `/api/academics/assign/sections/${sectionId}`,
  );
  return res.data;
}

export async function createSection(input: {
  name: string;
  gradeLevel: GradeLevel;
}): Promise<Section> {
  const res = await apiClient.post<Section>("/api/academics/assign/sections", input);
  return res.data;
}
