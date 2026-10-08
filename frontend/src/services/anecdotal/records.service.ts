import { apiClient } from "@/lib/api/client";
import type {
  AnecdotalOptions,
  AnecdotalPayload,
  CreatedAnecdotalRecord,
} from "./anecdotal.types";

export async function fetchAnecdotalOptions(): Promise<AnecdotalOptions> {
  const { data } = await apiClient.get<AnecdotalOptions>(
    "/api/teacher/grade-flags/options"
  );
  return data;
}

export async function createAnecdotalRecord(
  payload: AnecdotalPayload
): Promise<CreatedAnecdotalRecord> {
  const { data } = await apiClient.post<CreatedAnecdotalRecord>(
    "/api/anecdotal",
    payload
  );
  return data;
}
