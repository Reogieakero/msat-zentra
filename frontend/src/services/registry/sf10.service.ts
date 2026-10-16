import { apiClient } from "@/lib/api/client";
import type {
  Sf10AnalyzeResponse,
  Sf10AutoUploadResult,
  Sf10DetailResponse,
  Sf10Record,
  Sf10RecordsResponse,
  Sf10SubjectMapResponse,
  Sf10UploadResult,
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

export async function uploadSf10(studentId: string, file: File): Promise<Sf10UploadResult> {
  const form = new FormData();
  form.append("studentId", studentId);
  form.append("file", file);

  // apiClient defaults to application/json — override so the browser sends a
  // real multipart body (same pattern as clinic/session uploads).
  const res = await apiClient.post<Sf10UploadResult>("/api/sf10/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function analyzeSf10(file: File): Promise<Sf10AnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<Sf10AnalyzeResponse>("/api/sf10/analyze", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function uploadSf10Auto(
  file: File,
  gradeLevel?: string | null,
  signal?: AbortSignal,
): Promise<Sf10AutoUploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (gradeLevel) form.append("gradeLevel", gradeLevel);
  const res = await apiClient.post<Sf10AutoUploadResult>("/api/sf10/upload-auto", form, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });
  return res.data;
}

export async function fetchSf10SubjectMap(
  id: string,
  signal?: AbortSignal,
): Promise<Sf10SubjectMapResponse> {
  const res = await apiClient.get<Sf10SubjectMapResponse>(`/api/sf10/${id}/subject-map`, {
    signal,
  });
  return res.data;
}

export async function updateSf10OcrSubjects(
  id: string,
  subjects: Array<{
    rawName: string;
    grade?: number | null;
    rating?: number | null;
    gradeLevel?: string | null;
    quarters?: Array<number | null> | null;
    remarks?: string | null;
  }>,
): Promise<void> {
  await apiClient.patch(`/api/sf10/${id}/ocr`, { subjects });
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

export async function fetchSf10Detail(
  id: string,
  signal?: AbortSignal,
): Promise<Sf10DetailResponse> {
  const res = await apiClient.get<Sf10DetailResponse>(`/api/sf10/${id}/detail`, {
    signal,
  });
  return res.data;
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

export async function fetchRecordKeeperStudents(
  signal?: AbortSignal,
): Promise<UploadableStudent[]> {
  const res = await apiClient.get<{ students: UploadableStudent[] }>(
    "/api/record-keeper/students",
    { signal },
  );
  return res.data.students;
}
