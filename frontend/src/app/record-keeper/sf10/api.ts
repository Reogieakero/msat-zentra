import { apiClient } from "@/lib/api/client";
import type {
  Sf10Record,
  Sf10RecordsResponse,
  Sf10Version,
} from "./types";

export async function fetchSf10Records(signal?: AbortSignal): Promise<Sf10Record[]> {
  const res = await apiClient.get<Sf10RecordsResponse>("/api/sf10/records", { signal });
  return res.data.records;
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
