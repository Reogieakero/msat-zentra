"use client";

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  usePaginatedQuery,
  type PaginatedEnvelope,
} from "@/lib/api/usePaginatedQuery";

export type AdvisoryModuleKind = "general" | "adm";
export type AdvisoryModuleStatus = "submitted" | "pending" | "overdue" | "posted";
export type AdvisoryFilterStatus = "submitted" | "pending" | "overdue";

export interface AdvisoryModuleSection {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface ModuleStatusCounts {
  all: number;
  submitted: number;
  pending: number;
  overdue: number;
}

export interface AdvisoryModuleRow {
  id: string;
  kind: AdvisoryModuleKind;
  moduleName: string;
  moduleUrl: string | null;
  description: string | null;
  releaseDate: string | null;
  dueDate: string | null;
  /** Learners in the section who handed this module in. */
  submittedCount: number;
  totalLearners: number;
  /** Aggregate: submitted only when every learner handed it in. */
  status: AdvisoryModuleStatus;
  createdAt: string;
  updatedAt: string;
}

export type AdvisoryModulesResponse = PaginatedEnvelope<AdvisoryModuleRow> & {
  section: AdvisoryModuleSection;
  sections: AdvisoryModuleSection[];
  counts: ModuleStatusCounts;
};

export type AdvisorySubmissionKind = "link" | "file" | "physical";

export interface AdvisorySubmissionRow {
  key: string;
  studentId: string | null;
  rosterId: string | null;
  name: string;
  lrn: string;
  /** Persisted sprite mascot; null falls back to the `${name}:${lrn}` pick. */
  mascot: string | null;
  submissionUrl: string | null;
  submissionKind: AdvisorySubmissionKind;
  fileUrl: string | null;
  fileName: string | null;
  submitted: boolean;
  submittedAt: string | null;
  remarks: string | null;
  status: AdvisoryModuleStatus;
}

export type AdvisorySubmissionsResponse = PaginatedEnvelope<AdvisorySubmissionRow> & {
  module: {
    id: string;
    kind: AdvisoryModuleKind;
    moduleName: string;
    moduleUrl: string | null;
    releaseDate: string | null;
    dueDate: string | null;
    section: string;
  };
  counts: ModuleStatusCounts;
};

export interface AdvisoryModulePayload {
  moduleName?: string;
  kind?: AdvisoryModuleKind;
  moduleUrl?: string | null;
  description?: string | null;
  dueDate?: string | null;
  sectionId?: string;
}

export interface AdvisorySubmissionPayload {
  studentId?: string;
  rosterId?: string;
  submissionKind?: AdvisorySubmissionKind;
  submissionUrl?: string | null;
  submitted?: boolean;
  remarks?: string | null;
}

const MODULE_KEY = "advisory-modules";

type ListSnapshot = { key: QueryKey; data: AdvisoryModulesResponse | undefined };

const moduleListQueries = (qc: QueryClient) =>
  qc.getQueryCache().findAll({ queryKey: [MODULE_KEY, "list"] });

/** Cancel in-flight list reads and snapshot every cached page before patching. */
async function snapshotModuleLists(qc: QueryClient): Promise<ListSnapshot[]> {
  await qc.cancelQueries({ queryKey: [MODULE_KEY, "list"] });
  return moduleListQueries(qc).map((q) => ({
    key: q.queryKey,
    data: q.state.data as AdvisoryModulesResponse | undefined,
  }));
}

function restoreModuleLists(qc: QueryClient, snapshots: ListSnapshot[]) {
  for (const s of snapshots) qc.setQueryData(s.key, s.data);
}

/** Apply an optimistic change to every cached module list page. */
function patchModuleLists(
  qc: QueryClient,
  update: (data: AdvisoryModulesResponse, key: QueryKey) => AdvisoryModulesResponse,
) {
  for (const q of moduleListQueries(qc)) {
    const data = q.state.data as AdvisoryModulesResponse | undefined;
    if (!data) continue;
    qc.setQueryData(q.queryKey, update(data, q.queryKey));
  }
}

const listFilters = (key: QueryKey) => (key[4] ?? {}) as { status?: string };
const listPage = (key: QueryKey) => (typeof key[2] === "number" ? key[2] : 1);

/** Keep the board counts in step with an added/removed module. */
function adjustCounts(
  counts: ModuleStatusCounts,
  status: AdvisoryModuleStatus,
  delta: number,
): ModuleStatusCounts {
  const next = { ...counts, all: Math.max(0, counts.all + delta) };
  if (status !== "posted") next[status] = Math.max(0, next[status] + delta);
  return next;
}

export async function fetchAdvisoryModules(params: {
  page: number;
  sectionId?: string;
  status?: AdvisoryFilterStatus;
  signal?: AbortSignal;
}): Promise<AdvisoryModulesResponse> {
  const { data } = await apiClient.get<AdvisoryModulesResponse>(
    "/api/teacher/advisory/modules",
    {
      params: {
        page: params.page,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      signal: params.signal,
    },
  );
  return data;
}

export function useAdvisoryModules(options: {
  page: number;
  sectionId?: string;
  status?: AdvisoryFilterStatus;
  enabled?: boolean;
}) {
  const { page, sectionId, status, enabled = true } = options;
  return usePaginatedQuery<AdvisoryModuleRow>({
    module: MODULE_KEY,
    resource: "list",
    page,
    filters: { sectionId: sectionId ?? "", status: status ?? "" },
    preset: "live",
    enabled,
    fetcher: (signal) => fetchAdvisoryModules({ page, sectionId, status, signal }),
  });
}

/** Counts/sections ride along the paginated envelope; read them with this. */
export function modulesExtras(
  data: PaginatedEnvelope<AdvisoryModuleRow> | undefined,
): AdvisoryModulesResponse | undefined {
  return data as AdvisoryModulesResponse | undefined;
}

export async function fetchModuleSubmissions(params: {
  moduleId: string;
  page: number;
  status?: AdvisoryModuleStatus;
  signal?: AbortSignal;
}): Promise<AdvisorySubmissionsResponse> {
  const { data } = await apiClient.get<AdvisorySubmissionsResponse>(
    `/api/teacher/advisory/modules/${params.moduleId}/submissions`,
    {
      params: {
        page: params.page,
        ...(params.status ? { status: params.status } : {}),
      },
      signal: params.signal,
    },
  );
  return data;
}

export function useModuleSubmissions(options: {
  moduleId: string | null;
  page: number;
  status?: AdvisoryFilterStatus;
  enabled?: boolean;
}) {
  const { moduleId, page, status, enabled = true } = options;
  return usePaginatedQuery<AdvisorySubmissionRow>({
    module: MODULE_KEY,
    resource: "submissions",
    page,
    filters: { moduleId: moduleId ?? "", status: status ?? "" },
    preset: "live",
    enabled: enabled && !!moduleId && !moduleId.startsWith("optimistic-"),
    fetcher: (signal) =>
      fetchModuleSubmissions({ moduleId: moduleId as string, page, status, signal }),
  });
}

export function submissionsExtras(
  data: PaginatedEnvelope<AdvisorySubmissionRow> | undefined,
): AdvisorySubmissionsResponse | undefined {
  return data as AdvisorySubmissionsResponse | undefined;
}

export async function createAdvisoryModule(payload: AdvisoryModulePayload) {
  const { data } = await apiClient.post<{ id: string }>(
    "/api/teacher/advisory/modules",
    payload,
  );
  return data;
}

export async function updateAdvisoryModule(
  moduleId: string,
  payload: AdvisoryModulePayload,
) {
  const { data } = await apiClient.patch<{ id: string }>(
    `/api/teacher/advisory/modules/${moduleId}`,
    payload,
  );
  return data;
}

export async function deleteAdvisoryModule(moduleId: string) {
  await apiClient.delete(`/api/teacher/advisory/modules/${moduleId}`);
}

/** Invalidate every advisory-modules read (board + submissions). */
export function useInvalidateAdvisoryModules() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [MODULE_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] }),
    ]);
}

export function useCreateAdvisoryModule() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAdvisoryModules();
  return useMutation<
    { id: string },
    Error,
    AdvisoryModulePayload,
    { snapshots: ListSnapshot[] }
  >({
    mutationFn: createAdvisoryModule,
    // Optimistic insert: the new card shows on the board before the request returns.
    onMutate: async (payload) => {
      const snapshots = await snapshotModuleLists(qc);
      const sample = snapshots.find((s) => s.data?.data.length)?.data;
      const totalLearners = sample?.data[0]?.totalLearners ?? 0;
      const kind = payload.kind ?? "general";
      const now = new Date().toISOString();
      const status: AdvisoryModuleStatus = kind === "general" ? "posted" : "pending";
      const optimistic: AdvisoryModuleRow = {
        id: `optimistic-${now}`,
        kind,
        moduleName: payload.moduleName?.trim() || "Untitled module",
        moduleUrl: payload.moduleUrl ?? null,
        description: payload.description ?? null,
        releaseDate: payload.moduleUrl ? now : null,
        dueDate: payload.dueDate ?? null,
        submittedCount: 0,
        totalLearners,
        status,
        createdAt: now,
        updatedAt: now,
      };
      patchModuleLists(qc, (data, key) => {
        const counts = adjustCounts(data.counts, status, 1);
        const filter = listFilters(key);
        if (listPage(key) !== 1 || (filter.status && filter.status !== status)) {
          return { ...data, counts };
        }
        const total = data.total + 1;
        return {
          ...data,
          data: [optimistic, ...data.data].slice(0, data.pageSize),
          counts,
          total,
          totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
        };
      });
      return { snapshots };
    },
    onError: (_err, _payload, context) => {
      if (context) restoreModuleLists(qc, context.snapshots);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateAdvisoryModule() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAdvisoryModules();
  return useMutation<
    { id: string },
    Error,
    { moduleId: string; payload: AdvisoryModulePayload },
    { snapshots: ListSnapshot[] }
  >({
    mutationFn: (vars: { moduleId: string; payload: AdvisoryModulePayload }) =>
      updateAdvisoryModule(vars.moduleId, vars.payload),
    // Optimistic edit: the card reflects the new values instantly.
    onMutate: async ({ moduleId, payload }) => {
      const snapshots = await snapshotModuleLists(qc);
      const now = new Date().toISOString();
      patchModuleLists(qc, (data) => ({
        ...data,
        data: data.data.map((row) =>
          row.id === moduleId
            ? {
                ...row,
                ...(payload.moduleName !== undefined ? { moduleName: payload.moduleName } : {}),
                ...(payload.moduleUrl !== undefined ? { moduleUrl: payload.moduleUrl } : {}),
                ...(payload.description !== undefined ? { description: payload.description } : {}),
                ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
                updatedAt: now,
              }
            : row,
        ),
      }));
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreModuleLists(qc, context.snapshots);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAdvisoryModule() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAdvisoryModules();
  return useMutation<
    void,
    Error,
    string,
    { snapshots: ListSnapshot[] }
  >({
    mutationFn: deleteAdvisoryModule,
    // Optimistic remove: the card disappears the moment Remove is confirmed.
    onMutate: async (moduleId) => {
      const snapshots = await snapshotModuleLists(qc);
      let removed: AdvisoryModuleRow | undefined;
      for (const s of snapshots) {
        const found = s.data?.data.find((row) => row.id === moduleId);
        if (found) {
          removed = found;
          break;
        }
      }
      patchModuleLists(qc, (data) => {
        if (!data.data.some((row) => row.id === moduleId)) return data;
        const counts = removed ? adjustCounts(data.counts, removed.status, -1) : data.counts;
        const total = Math.max(0, data.total - 1);
        return {
          ...data,
          data: data.data.filter((row) => row.id !== moduleId),
          counts,
          total,
          totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
        };
      });
      return { snapshots };
    },
    onError: (_err, _moduleId, context) => {
      if (context) restoreModuleLists(qc, context.snapshots);
    },
    onSuccess: invalidate,
  });
}
