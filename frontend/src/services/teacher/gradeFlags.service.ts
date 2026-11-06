import { apiClient } from "@/lib/api/client";
import { pickList } from "@/lib/api/payload";
import type {
  FlagOptions,
  FlagScope,
  FlagStatus,
  GradeFlagRow,
  RaiseFlagPayload,
} from "./gradeFlags.types";

export async function fetchFlags(
  scope: FlagScope,
  opts?: { status?: FlagStatus; q?: string; page?: number; pageSize?: number; signal?: AbortSignal }
): Promise<GradeFlagRow[]> {
  const params = new URLSearchParams({ scope });
  if (opts?.status) params.set("status", opts.status);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  const { data } = await apiClient.get<
    GradeFlagRow[] | { data: GradeFlagRow[]; rows: GradeFlagRow[] }
  >(`/api/teacher/grade-flags?${params.toString()}`, { signal: opts?.signal });

  return pickList<GradeFlagRow>(data, "rows", "data");
}

export async function fetchFlagOptions(): Promise<FlagOptions> {
  const { data } = await apiClient.get<FlagOptions>("/api/teacher/grade-flags/options");
  return data;
}

export async function raiseFlag(payload: RaiseFlagPayload): Promise<GradeFlagRow> {
  const { data } = await apiClient.post<GradeFlagRow>("/api/teacher/grade-flags", payload);
  return data;
}

export async function resolveFlag(id: string, resolutionNote: string): Promise<GradeFlagRow> {
  const { data } = await apiClient.post<GradeFlagRow>(
    `/api/teacher/grade-flags/${id}/resolve`,
    { resolutionNote }
  );
  return data;
}

export function formatAge(ageDays: number): string {
  if (ageDays < 1) return "today";
  if (ageDays === 1) return "1d open";
  return `${ageDays}d open`;
}
