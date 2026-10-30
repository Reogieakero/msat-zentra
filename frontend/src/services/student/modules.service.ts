"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  usePaginatedQuery,
  type PaginatedEnvelope,
} from "@/lib/api/usePaginatedQuery";

export type StudentModuleStatus = "submitted" | "pending" | "overdue" | "posted";
export type StudentModuleKind = "general" | "adm";
export type StudentSubmissionKind = "link" | "file" | "physical";
export type StudentFilterStatus = "submitted" | "pending" | "overdue";

export interface StudentModuleSection {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface StudentModuleCounts {
  all: number;
  submitted: number;
  pending: number;
  overdue: number;
}

export interface StudentModuleRow {
  id: string;
  kind: StudentModuleKind;
  moduleName: string;
  moduleUrl: string | null;
  description: string | null;
  releaseDate: string | null;
  dueDate: string | null;
  /** This learner's own submission state. */
  submitted: boolean;
  submissionKind: StudentSubmissionKind;
  submissionUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  submittedAt: string | null;
  remarks: string | null;
  status: StudentModuleStatus;
}

export type StudentModulesResponse = PaginatedEnvelope<StudentModuleRow> & {
  section: StudentModuleSection | null;
  learner: { name: string; lrn: string; mascot: string | null };
  counts: StudentModuleCounts;
};

const MODULE_KEY = "student-modules";
const TEACHER_MODULE_KEY = "advisory-modules";

export async function fetchStudentModules(params: {
  page: number;
  status?: StudentFilterStatus;
  signal?: AbortSignal;
}): Promise<StudentModulesResponse> {
  const { data } = await apiClient.get<StudentModulesResponse>("/api/student/modules", {
    params: {
      page: params.page,
      ...(params.status ? { status: params.status } : {}),
    },
    signal: params.signal,
  });
  return data;
}

export function useStudentModules(options: { page: number; status?: StudentFilterStatus }) {
  const { page, status } = options;
  return usePaginatedQuery<StudentModuleRow>({
    module: MODULE_KEY,
    resource: "list",
    page,
    filters: { status: status ?? "" },
    preset: "live",
    fetcher: (signal) => fetchStudentModules({ page, status, signal }),
  });
}

/** Counts/section/learner ride along the paginated envelope. */
export function studentModulesExtras(
  data: PaginatedEnvelope<StudentModuleRow> | undefined,
): StudentModulesResponse | undefined {
  return data as StudentModulesResponse | undefined;
}

export async function submitStudentLink(
  moduleId: string,
  payload: { submissionUrl: string; remarks?: string | null },
) {
  const { data } = await apiClient.put<{ id: string }>(
    `/api/student/modules/${moduleId}/submission`,
    payload,
  );
  return data;
}

export async function submitStudentPhysical(moduleId: string) {
  const { data } = await apiClient.post<{ id: string }>(
    `/api/student/modules/${moduleId}/submission/physical`,
  );
  return data;
}

export async function uploadStudentSubmission(
  moduleId: string,
  input: { kind: "file" | "physical"; file: File; remarks?: string | null },
) {
  const form = new FormData();
  form.append("kind", input.kind);
  if (input.remarks) form.append("remarks", input.remarks);
  form.append("file", input.file);
  const { data } = await apiClient.post<{ id: string }>(
    `/api/student/modules/${moduleId}/submission/upload`,
    form,
  );
  return data;
}

/** Refresh the learner's list and any adviser board cached in this session. */
export function useInvalidateStudentModules() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [MODULE_KEY] }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_MODULE_KEY] }),
    ]);
}

export function useSubmitStudentLink() {
  const invalidate = useInvalidateStudentModules();
  return useMutation({
    mutationFn: (vars: {
      moduleId: string;
      submissionUrl: string;
      remarks?: string | null;
    }) => submitStudentLink(vars.moduleId, { submissionUrl: vars.submissionUrl, remarks: vars.remarks }),
    onSuccess: invalidate,
  });
}

export function useSubmitStudentPhysical() {
  const invalidate = useInvalidateStudentModules();
  return useMutation({
    mutationFn: (moduleId: string) => submitStudentPhysical(moduleId),
    onSuccess: invalidate,
  });
}

export function useUploadStudentSubmission() {
  const invalidate = useInvalidateStudentModules();
  return useMutation({
    mutationFn: (vars: {
      moduleId: string;
      kind: "file" | "physical";
      file: File;
      remarks?: string | null;
    }) => uploadStudentSubmission(vars.moduleId, vars),
    onSuccess: invalidate,
  });
}
