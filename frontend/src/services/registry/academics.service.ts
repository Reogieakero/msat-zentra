import { apiClient } from "@/lib/api/client";

/** One row of the record-keeper G7–10 subject catalog. */
export interface RegistrySubject {
  id: string;
  code: string;
  name: string;
  gradeLevel: number;
  category: string;
  active: boolean;
  enrolled: number;
  passed: number;
  failed: number;
}

export interface RegistrySubjectsResponse {
  subjects: RegistrySubject[];
}

/**
 * Banded subject catalog for either registry desk. The record keeper reads
 * G7–10, the registrar G11–12; the backend bands both by the caller's role.
 */
export async function fetchRegistrySubjects(
  desk: "record-keeper" | "registrar",
  signal?: AbortSignal,
): Promise<RegistrySubject[]> {
  const { data } = await apiClient.get<RegistrySubjectsResponse>(
    `/api/${desk}/academics/subjects`,
    { signal },
  );
  return data.subjects;
}

export async function fetchRecordKeeperSubjects(
  signal?: AbortSignal,
): Promise<RegistrySubject[]> {
  return fetchRegistrySubjects("record-keeper", signal);
}
