// Types, label maps, and API access for the Principal Audit Log page.
// Backed by GET /api/audit (see backend/src/modules/audit/audit.routes.ts).

import { apiClient } from "@/lib/api/client";

export type AuditActionType =
  | "sf10_update"
  | "grade_lock"
  | "grade_unlock"
  | "anecdotal_edit"
  | "health_record_edit"
  | "home_visitation_edit"
  | "adm_edit"
  | "referral_status_change"
  | "intervention_approval"
  | "account_approval"
  | "role_change"
  | "adm_principal_approve"
  | "school_year_create"
  | "term_create"
  | "school_year_set_active"
  | "school_year_edit"
  | "honor_roll_mark_awarded"
  | "report_refresh"
  | "principal_profile_change"
  | "principal_password_change";

export type AuditRole =
  | "principal"
  | "subject_teacher"
  | "adviser"
  | "guidance_counselor"
  | "nurse"
  | "adm_coordinator"
  | "record_keeper"
  | "registrar"
  | "system";

export type ConfidentialTable =
  | "anecdotal_records"
  | "health_records"
  | "home_visitation_records"
  | "adm_learner_profiles";

export type AuditEntry = {
  id: string;
  timestamp: string; // ISO
  user: string;
  actorRole: AuditRole;
  actionType: AuditActionType;
  sourceTable: string;
  sourceId: string;
  sourceLabel: string;
  reason: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
};

export type AuditQuery = {
  actionType?: AuditActionType | "all";
  actorRole?: AuditRole | "all";
  sourceTable?: string | "all";
  userId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export const ACTION_LABELS: Record<AuditActionType, string> = {
  sf10_update: "SF10 update",
  grade_lock: "Grade lock",
  grade_unlock: "Grade unlock",
  anecdotal_edit: "Anecdotal edit",
  health_record_edit: "Health record edit",
  home_visitation_edit: "Home visitation edit",
  adm_edit: "ADM edit",
  referral_status_change: "Referral status change",
  intervention_approval: "Intervention approval",
  account_approval: "Account approval",
  role_change: "Role change",
  adm_principal_approve: "ADM final sign",
  school_year_create: "School year create",
  term_create: "Term create",
  school_year_set_active: "Set active year",
  school_year_edit: "School year edit",
  honor_roll_mark_awarded: "Honor roll awarded",
  report_refresh: "Report refresh",
  principal_profile_change: "Profile change",
  principal_password_change: "Password change",
};

export const ROLE_LABELS: Record<AuditRole, string> = {
  principal: "Principal",
  subject_teacher: "Subject Teacher",
  adviser: "Adviser",
  guidance_counselor: "Guidance Counselor",
  nurse: "School Nurse",
  adm_coordinator: "ADM Coordinator",
  record_keeper: "Record Keeper",
  registrar: "Registrar",
  system: "System",
};

export const CONFIDENTIAL_TABLES: ConfidentialTable[] = [
  "anecdotal_records",
  "health_records",
  "home_visitation_records",
  "adm_learner_profiles",
];

export function isConfidentialTable(table: string): boolean {
  return (CONFIDENTIAL_TABLES as string[]).includes(table);
}

export const ACTION_TYPES: { value: AuditActionType; label: string }[] = Object.entries(
  ACTION_LABELS,
).map(([value, label]) => ({ value: value as AuditActionType, label }));

// Roles that actually appear in the audit log (drives the Role filter).
export const ACTOR_ROLES: AuditRole[] = [
  "principal",
  "subject_teacher",
  "adviser",
  "guidance_counselor",
  "nurse",
  "adm_coordinator",
  "record_keeper",
  "registrar",
];

function buildParams(query: AuditQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.actionType && query.actionType !== "all") params.actionType = query.actionType;
  if (query.actorRole && query.actorRole !== "all") params.actorRole = query.actorRole;
  if (query.sourceTable && query.sourceTable !== "all") params.sourceTable = query.sourceTable;
  if (query.userId) params.userId = query.userId;
  if (query.q) params.q = query.q;
  if (query.page) params.page = String(query.page);
  if (query.pageSize) params.pageSize = String(query.pageSize);
  return params;
}

export async function fetchAuditEntries(
  query: AuditQuery,
  signal?: AbortSignal,
): Promise<AuditResponse> {
  const res = await apiClient.get<AuditResponse>("/api/audit", {
    params: buildParams(query),
    signal,
  });
  return res.data;
}

export async function exportAuditCsv(query: AuditQuery): Promise<void> {
  const res = await apiClient.get<Blob>("/api/audit/export", {
    params: buildParams(query),
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit-log.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export type AuditSourceResponse = {
  sourceTable: string;
  sourceId: string;
  confidential: boolean;
  fields: { label: string; value: string }[];
};

export async function fetchAuditSource(id: string): Promise<AuditSourceResponse> {
  const res = await apiClient.get<AuditSourceResponse>(`/api/audit/${id}/source`);
  return res.data;
}
