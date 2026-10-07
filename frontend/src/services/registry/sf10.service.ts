// Shared SF10 record actions (registrar + record-keeper desks hit the
// same role-agnostic `/api/sf10/*` endpoints). Registrar-only extras
// (`uploadSf10`, `fetchRegistrarStudents`) currently have no consumers —
// moved verbatim and flagged, not deleted.
import { apiClient } from "@/lib/api/client";
import type {
  Sf10Record,
  Sf10RecordsResponse,
  Sf10Version,
} from "./sf10.types";

export interface Sf10ListParams {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  signal?: AbortSignal;
}

export interface Sf10ListResult {
  records: Sf10Record[];
  total: number;
  page: number;
  pageSize: number;
  counts: { attach: number; available: number; released: number; total: number };
}

export async function fetchSf10Records(
  params: Sf10ListParams,
): Promise<Sf10ListResult> {
  const { signal, ...query } = params;
  const res = await apiClient.get<Sf10RecordsResponse>("/api/sf10/records", {
    params: query,
    signal,
  });
  const data = res.data;
  return {
    records: data.records,
    total: data.total ?? data.records.length,
    page: data.page ?? params.page,
    pageSize: data.pageSize ?? params.pageSize,
    counts: data.counts ?? {
      attach: 0,
      available: 0,
      released: 0,
      total: data.records.length,
    },
  };
}

export async function uploadSf10(studentId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("studentId", studentId);
  form.append("file", file);
  // Let axios set the multipart boundary automatically (do not override Content-Type).
  await apiClient.post("/api/sf10/upload", form);
}

export async function validateSf10(id: string): Promise<void> {
  await apiClient.post(`/api/sf10/${id}/validate`);
}

export async function releaseSf10(id: string): Promise<void> {
  await apiClient.post(`/api/sf10/${id}/release`);
}

export async function fetchSf10Versions(
  id: string,
  signal?: AbortSignal,
): Promise<Sf10Version[]> {
  const res = await apiClient.get<{ versions: Sf10Version[] }>(
    `/api/sf10/${id}/versions`,
    { signal },
  );
  return res.data.versions;
}

export type UploadableStudent = {
  studentId: string;
  lrn: string;
  fullName: string;
  gradeLevel: string;
  section: string;
};

export async function fetchRegistrarStudents(
  signal?: AbortSignal,
): Promise<UploadableStudent[]> {
  const res = await apiClient.get<{ students: UploadableStudent[] }>(
    "/api/registrar/students",
    { signal },
  );
  return res.data.students;
}
