import { apiClient } from "@/lib/api/client";
import type { AuditQuery, AuditResponse } from "./audit.types";

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
