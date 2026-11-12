"use client";

import { useLiveQuery } from "@/lib/api/live";
import { apiClient } from "@/lib/api/client";
import type { PaginatedEnvelope } from "@/lib/api/usePaginatedQuery";

export type AdvisoryInterventionLevel = "High" | "Moderate" | "Low";
export type AdvisoryInterventionFactor = "academic" | "attendance" | "behavioral";
export type AdvisoryInterventionOutcome =
  | "ongoing"
  | "resolved"
  | "unresolved"
  | "none";

export type AdvisoryApprovalStatus = "pending" | "approved" | "rejected" | "modified";
export type AdvisoryOutcomeStatus = "ongoing" | "resolved" | "unresolved";

export interface AdvisoryInterventionSection {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface AdvisoryInterventionSession {
  id: string;
  sessionType: string;
  scheduledAt: string;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  attachmentsCount: number;
}

export interface AdvisoryInterventionDetail {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignee: string | null;
  assignedAt: string | null;
  approvalStatus: AdvisoryApprovalStatus;
  outcomeStatus: AdvisoryOutcomeStatus;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  sessions: AdvisoryInterventionSession[];
}

export interface AdvisoryInterventionRow {
  key: string;
  studentId: string | null;
  rosterId: string | null;
  name: string;
  lrn: string;
  mascot: string | null;
  sectionId: string;
  section: string;
  gradeLevel: string;
  riskLevel: string;
  riskCount: number;
  factors: {
    academic: boolean;
    attendance: boolean;
    behavioral: boolean;
  };
  /** Latest risk snapshot (fallback: intervention assignment date). */
  detectedAt: string | null;
  intervention: AdvisoryInterventionDetail | null;
}

export interface AdvisoryInterventionsSummary {
  high: number;
  moderate: number;
  low: number;
  ongoing: number;
  resolved: number;
  unresolved: number;
  noPlan: number;
  total: number;
}

export type AdvisoryInterventionsResponse = PaginatedEnvelope<AdvisoryInterventionRow> & {
  summary: AdvisoryInterventionsSummary;
  sections: AdvisoryInterventionSection[];
};

export interface AdvisoryInterventionsFilters {
  page: number;
  pageSize?: number;
  q?: string;
  sectionId?: string;
  level?: AdvisoryInterventionLevel;
  factor?: AdvisoryInterventionFactor;
  outcome?: AdvisoryInterventionOutcome;
}

/** The adviser board pages a 4×4 card grid; backend allow-lists 16. */
export const ADVISORY_INTERVENTIONS_PAGE_SIZE = 16;

export async function fetchAdvisoryInterventions(
  params: AdvisoryInterventionsFilters & { signal?: AbortSignal },
): Promise<AdvisoryInterventionsResponse> {
  const { data } = await apiClient.get<AdvisoryInterventionsResponse>(
    "/api/teacher/advisory/interventions",
    {
      params: {
        page: params.page,
        pageSize: params.pageSize ?? ADVISORY_INTERVENTIONS_PAGE_SIZE,
        ...(params.q ? { q: params.q } : {}),
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        ...(params.level ? { level: params.level } : {}),
        ...(params.factor ? { factor: params.factor } : {}),
        ...(params.outcome ? { outcome: params.outcome } : {}),
      },
      signal: params.signal,
    },
  );
  return data;
}

/**
 * The adviser board filters locally so search and tabs are instant (same as
 * the guidance board), so it loads the whole section queue once instead of
 * refetching on every keystroke. The endpoint caps pageSize at 16, hence the
 * page fan-out.
 */
export async function fetchAllAdvisoryInterventions(
  opts: { signal?: AbortSignal } = {},
): Promise<AdvisoryInterventionsResponse> {
  const first = await fetchAdvisoryInterventions({ page: 1, signal: opts.signal });
  if (first.totalPages <= 1) return first;
  // Pages are independent — fetch in parallel instead of sequentially.
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchAdvisoryInterventions({ page: i + 2, signal: opts.signal }),
    ),
  );
  return {
    ...first,
    data: [first.data, ...rest.map((page) => page.data)].flat(),
    page: 1,
  };
}

export function useAdvisoryInterventionsQueue(termKey: string, enabled: boolean) {
  return useLiveQuery<AdvisoryInterventionsResponse>({
    queryKey: ["advisory-interventions", "queue", termKey],
    queryFn: ({ signal }) => fetchAllAdvisoryInterventions({ signal }),
    staleTime: 60_000,
    enabled,
  });
}
