import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { PaginatedEnvelope } from "@/lib/api/usePaginatedQuery";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  /** Stored mascot character; null falls back to a derived sprite. */
  mascot: string | null;
}

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    byRole: Record<string, number>;
  };
  academics: { sections: number; subjects: number; schoolYears: number };
  operations: {
    referralsOpen: number;
    interventionsOngoing: number;
    admOpen: number;
    sf10Pending: number;
  };
  recentUsers: AdminUser[];
}

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  actorRole: string;
  actionType: string;
  sourceTable: string;
  sourceId: string;
  reason: string;
  sourceLabel: string;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminPresenceUser {
  id: string;
  fullName: string;
  role: string;
  ip: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  lastActiveAt: string;
  approximate: boolean;
}

export interface AdminPresenceResponse {
  active: AdminPresenceUser[];
  generatedAt: string;
  approximate: boolean;
  windowMinutes: number;
}

export interface AdminLoginActivityEvent {
  id: string;
  at: string;
  kind: "login" | "logout";
  fullName: string;
  role: string;
  mascot: string | null;
}

export interface AdminLoginActivityResponse {
  events: AdminLoginActivityEvent[];
  total: number;
  signOuts: number;
  windowHours: number;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await apiClient.get<AdminOverview>("/api/admin/overview");
  return data;
}

export async function fetchAdminPresence(): Promise<AdminPresenceResponse> {
  const { data } = await apiClient.get<AdminPresenceResponse>("/api/admin/presence");
  return data;
}

export async function fetchAdminLoginActivity(
  hours = 24,
): Promise<AdminLoginActivityResponse> {
  const { data } = await apiClient.get<AdminLoginActivityResponse>(
    "/api/admin/login-activity",
    { params: { hours } },
  );
  return data;
}

/**
 * Live presence for the overview globe. Polls quickly and never reuses a stale
 * snapshot — "active now" is the whole point of the board. The board updates
 * itself in place; the administrator never has to refresh the page.
 */
export function useAdminPresence() {
  return useQuery({
    queryKey: ["admin", "presence"],
    queryFn: fetchAdminPresence,
    refetchInterval: 8_000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** Sign-ins per hour for the overview chart; refreshes on its own. */
export function useAdminLoginActivity(hours = 24) {
  return useQuery({
    queryKey: ["admin", "login-activity", hours],
    queryFn: () => fetchAdminLoginActivity(hours),
    refetchInterval: 60_000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export async function fetchAdminUsers(params: {
  page: number;
  pageSize: number;
  q?: string;
  role?: string;
  status?: string;
  signal?: AbortSignal;
}): Promise<PaginatedEnvelope<AdminUser>> {
  const { data } = await apiClient.get<PaginatedEnvelope<AdminUser>>(
    "/api/admin/users",
    {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        ...(params.q ? { q: params.q } : {}),
        ...(params.role ? { role: params.role } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      signal: params.signal,
    },
  );
  return data;
}

export async function updateAdminUserStatus(
  id: string,
  status: "active" | "suspended",
): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.patch<{ id: string; status: string }>(
    `/api/admin/users/${id}/status`,
    { status },
  );
  return data;
}

export async function fetchAdminAudit(params: {
  page: number;
  pageSize: number;
  q?: string;
  actionType?: string;
  sourceTable?: string;
  signal?: AbortSignal;
}): Promise<AdminAuditPage> {
  const { data } = await apiClient.get<AdminAuditPage>("/api/admin/audit", {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      ...(params.q ? { q: params.q } : {}),
      ...(params.actionType ? { actionType: params.actionType } : {}),
      ...(params.sourceTable ? { sourceTable: params.sourceTable } : {}),
    },
    signal: params.signal,
  });
  return data;
}
