import { apiClient } from "@/lib/api/client";

export interface RecordFolder {
  id: string;
  name: string;
  createdAt: string;
  recordCount: number;
}

export interface MyAnecdotalRecord {
  id: string;
  observationDatetime: string;
  /** Set only on the "Deleted records" view (soft-deleted, restorable). */
  deletedAt?: string | null;
  category: string;
  confidentialityLevel: string;
  incident: string;
  studentId: string;
  studentName: string;
  lrn: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot?: string | null;
  section: string;
  signed?: boolean;
  /** True once the record has been edited after filing (audit-derived). */
  edited?: boolean;
  folderId: string | null;
  folderName: string | null;
  /** Term the record was filed in — the desk shows every term of the school year. */
  termNumber?: number;
}

export async function fetchRecordFolders(): Promise<RecordFolder[]> {
  const { data } = await apiClient.get<RecordFolder[]>("/api/anecdotal/folders");
  return data;
}

export async function createRecordFolder(name: string): Promise<RecordFolder> {
  const { data } = await apiClient.post<RecordFolder>("/api/anecdotal/folders", {
    name,
  });
  return data;
}

export async function renameRecordFolder(id: string, name: string): Promise<RecordFolder> {
  const { data } = await apiClient.patch<RecordFolder>(
    `/api/anecdotal/folders/${id}`,
    { name }
  );
  return data;
}

export async function deleteRecordFolder(id: string): Promise<void> {
  await apiClient.delete(`/api/anecdotal/folders/${id}`);
}

export async function fetchMyRecords(): Promise<MyAnecdotalRecord[]> {
  const { data } = await apiClient.get<MyAnecdotalRecord[]>("/api/anecdotal/mine");
  return data;
}

export async function fetchDeletedRecords(): Promise<MyAnecdotalRecord[]> {
  const { data } = await apiClient.get<MyAnecdotalRecord[]>("/api/anecdotal/deleted");
  return data;
}

export interface UpdateAnecdotalRecordInput {
  observationDatetime?: string;
  descriptionOfIncident?: string;
  descriptionOfLocation?: string | null;
  notesRecommendationsActions?: string | null;
  classPerformance?: string | null;
  attendanceSummary?: string | null;
  category?: string;
  confidentialityLevel?: "restricted" | "confidential";
}

export async function updateAnecdotalRecord(
  recordId: string,
  input: UpdateAnecdotalRecordInput,
): Promise<void> {
  await apiClient.patch(`/api/anecdotal/${recordId}`, input);
}

export async function deleteAnecdotalRecord(recordId: string): Promise<void> {
  await apiClient.delete(`/api/anecdotal/${recordId}`);
}

export async function restoreAnecdotalRecord(recordId: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${recordId}/restore`);
}

export async function moveRecord(
  recordId: string,
  folderId: string | null
): Promise<void> {
  await apiClient.patch(`/api/anecdotal/${recordId}/folder`, { folderId });
}
