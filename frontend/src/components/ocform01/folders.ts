import { apiClient } from "@/lib/api/client";

/**
 * Teacher-owned folders for filed anecdotal records. Unlike chat threads
 * (local UI sessions), folders live in the database, are scoped to the
 * owning teacher, and each folder has a dedicated records page.
 */

export interface RecordFolder {
  id: string;
  name: string;
  createdAt: string;
  recordCount: number;
}

export interface MyAnecdotalRecord {
  id: string;
  observationDatetime: string;
  category: string;
  confidentialityLevel: string;
  incident: string;
  studentId: string;
  studentName: string;
  lrn: string;
  section: string;
  folderId: string | null;
  folderName: string | null;
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

export async function moveRecord(
  recordId: string,
  folderId: string | null
): Promise<void> {
  await apiClient.patch(`/api/anecdotal/${recordId}/folder`, { folderId });
}
