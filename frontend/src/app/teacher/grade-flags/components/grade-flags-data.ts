import { apiClient } from "@/lib/api/client";

export type FlagStatus = "open" | "resolved" | "escalated";
export type FlagReason =
  | "wrong_score"
  | "missing_assessment"
  | "transmutation_error"
  | "late_submission"
  | "other";

export type FlagScope = "mine" | "against-me" | "advisees";

export const REASON_LABELS: Record<FlagReason, string> = {
  wrong_score: "Wrong score",
  missing_assessment: "Missing assessment",
  transmutation_error: "Transmutation error",
  late_submission: "Late submission",
  other: "Other",
};

export const STATUS_LABELS: Record<FlagStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  escalated: "Escalated",
};

export interface FlagStudent {
  id: string;
  name: string;
  lrn: string;
  sectionId?: string | null;
}

export interface GradeFlagRow {
  id: string;
  reason: FlagReason;
  note: string | null;
  status: FlagStatus;
  ageDays: number;
  createdAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  student: { id: string; name: string; lrn: string };
  subject: { id: string; name: string };
  section: { id: string; name: string };
  term: { id: string; termNumber: number };
  raisedBy: { id: string; fullName: string };
  owner: { id: string; fullName: string } | null;
}

export interface FlagClassOption {
  subjectId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  termId: string;
  termNumber: number;
  ownerName?: string;
}

export interface FlagOptions {
  students: FlagStudent[];
  classes: FlagClassOption[];
  sectionClasses: FlagClassOption[];
}

export interface FlagsPage {
  rows: GradeFlagRow[];
  total: number;
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

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
  // Defensive: the endpoint serves bare arrays today and a paginated object
  // tomorrow — never let a shape change crash the board.
  if (Array.isArray(data)) return data;
  const rows = (data as { rows?: unknown }).rows;
  if (Array.isArray(rows)) return rows as GradeFlagRow[];
  const legacy = (data as { data?: unknown }).data;
  return Array.isArray(legacy) ? (legacy as GradeFlagRow[]) : [];
}

export async function fetchFlagOptions(): Promise<FlagOptions> {
  const { data } = await apiClient.get<FlagOptions>("/api/teacher/grade-flags/options");
  return data;
}

export interface RaiseFlagPayload {
  studentId: string;
  subjectId: string;
  sectionId: string;
  termId: string;
  reason: FlagReason;
  note?: string;
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
