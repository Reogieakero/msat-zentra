"use client";

import * as React from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { fetchCoordinatorReferrals } from "@/services/coordinator/overview.service";
import { apiErrorMessage } from "@/lib/api/errors";
import type {
  AdmCaseRow,
  AdmEligibility,
} from "@/services/coordinator/coordinator.types";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { ELIG_OPTIONS } from "./coordinator-enrolled-constants";

/* Desk-level pagination standard: full list pages = 15. */
export const ENROLLED_PAGE_SIZE = 15;

export interface CoordinatorEnrolledModel {
  now: number;
  rows: AdmCaseRow[];
  total: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  safePage: number;
  start: number;
  end: number;
  enrolledPending: boolean;
  enrolledError: boolean;
  enrolledRefetching: boolean;
  /** Background refresh with data on screen — show a subtle sync hint,
      never the full skeleton. */
  enrolledBackground: boolean;
  refetchEnrolled: () => void;
  query: string;
  setQuery: (v: string) => void;
  debounced: string;
  elig: "all" | AdmEligibility;
  setElig: (v: "all" | AdmEligibility) => void;
  hasActiveFilters: boolean;
  eligMenuLabel: string;
  clearFilters: () => void;
  historyTarget: HistoryTarget | null;
  setHistoryTarget: (t: HistoryTarget | null) => void;
  completeTarget: AdmCaseRow | null;
  setCompleteTarget: (r: AdmCaseRow | null) => void;
  stagePending: boolean;
  /** Id of the row being completed — row-level `Marking…` state so
      unrelated rows stay usable during the mutation. */
  completingId: string | null;
  confirmComplete: () => void;
}

export function useCoordinatorEnrolled(): CoordinatorEnrolledModel {
  const queryClient = useQueryClient();
  const [now] = React.useState(() => Date.now());
  const [queryInput, setQueryInput] = React.useState("");
  // Debounced 300ms server search (registrar precedent).
  const debounced = useDebouncedValue(queryInput.trim(), 300);
  const [elig, setElig] = React.useState<"all" | AdmEligibility>("all");
  const [page, setPage] = React.useState(1);
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [completeTarget, setCompleteTarget] =
    React.useState<AdmCaseRow | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const setQuery = React.useCallback((v: string) => {
    setQueryInput(v);
    setPage(1);
  }, []);

  // Server-paginated enrollment monitoring (strict 15-row list pages).
  const enrolledQuery = useQuery({
    queryKey: ["coordinator-enrolled", page, debounced, elig, ENROLLED_PAGE_SIZE],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(page, {
        q: debounced || undefined,
        stage: "enrollment_monitoring",
        eligibility: elig,
        limit: ENROLLED_PAGE_SIZE,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Enrolled = approved by the Principal. Guard against any unapproved
  // row leaking through (e.g. stale cache from before signing).
  // Eligibility itself is filtered server-side (?eligibility=).
  // Defensive: non-array payloads never crash the grid.
  const rows = React.useMemo(() => {
    const all = Array.isArray(enrolledQuery.data?.rows)
      ? enrolledQuery.data.rows
      : [];
    return all.filter((r) => r.approvedBy);
  }, [enrolledQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-enrolled"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
  };

  const completeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "completion",
      });
      return data;
    },
    // Pessimistic: the row leaves the tab only via the refetch below after
    // the server confirms. No optimistic removal: the UI must never outrun
    // the processing. The acting row shows Completing… until settle.
    onSuccess: (_data, vars) => {
      markSelfNotified(vars.id);
      invalidate();
      setCompleteTarget(null);
      toast.success({
        title: "Marked as completed",
        description: "Device return can now be recorded on the Devices page.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not mark as completed",
        description: apiErrorMessage(err),
      }),
    onSettled: () => setCompletingId(null),
  });

  const hasActiveFilters = debounced !== "" || elig !== "all";
  const eligMenuLabel =
    ELIG_OPTIONS.find((o) => o.value === elig)?.label ?? "All statuses";

  function clearFilters() {
    setQueryInput("");
    setElig("all");
    setPage(1);
  }

  // `total` = filtered pager count; tiles read the UNFILTERED globals.
  const total = enrolledQuery.data?.total ?? 0;
  const totalPages = enrolledQuery.data?.totalPages ?? 1;
  // Derived clamp — never setState in an effect.
  const safePage = Math.min(page, totalPages);
  const limit = enrolledQuery.data?.limit ?? ENROLLED_PAGE_SIZE;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);

  return {
    now,
    rows,
    total,
    page,
    setPage,
    totalPages,
    safePage,
    start,
    end,
    enrolledPending: enrolledQuery.isPending,
    enrolledError: enrolledQuery.isError,
    enrolledRefetching: enrolledQuery.isRefetching,
    enrolledBackground: enrolledQuery.isFetching && !enrolledQuery.isPending,
    refetchEnrolled: () => {
      void enrolledQuery.refetch();
    },
    query: queryInput,
    setQuery,
    debounced,
    elig,
    setElig: (v: "all" | AdmEligibility) => {
      setElig(v);
      setPage(1);
    },
    hasActiveFilters,
    eligMenuLabel,
    clearFilters,
    historyTarget,
    setHistoryTarget,
    completeTarget,
    setCompleteTarget,
    stagePending: completeMutation.isPending,
    completingId,
    confirmComplete: () => {
      if (completeTarget && !completeMutation.isPending) {
        setCompletingId(completeTarget.id);
        completeMutation.mutate({ id: completeTarget.id });
      }
    },
  };
}
