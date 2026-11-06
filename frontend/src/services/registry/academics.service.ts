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

export async function fetchRecordKeeperSubjects(
  signal?: AbortSignal,
): Promise<RegistrySubject[]> {
  const { data } = await apiClient.get<RegistrySubjectsResponse>(
    "/api/record-keeper/academics/subjects",
    { signal },
  );
  return data.subjects;
}
