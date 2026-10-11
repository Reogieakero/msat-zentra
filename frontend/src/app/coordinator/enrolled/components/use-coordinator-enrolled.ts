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
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

export const ENROLLED_PAGE_SIZE = PAGE_SIZE;

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

  completingId: string | null;
  confirmComplete: () => void;
}

export function useCoordinatorEnrolled(): CoordinatorEnrolledModel {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [now] = React.useState(() => Date.now());
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");

  const debounced = useDebouncedValue(queryInput.trim(), 300);
  const [elig, setEligState] = React.useState<"all" | AdmEligibility>(() => {
    const e = searchParams.get("eligibility");
    return e === "eligible" || e === "ineligible" || e === "pending" ? e : "all";
  });
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "eligibility"] });
  const page = pager.page;
  const setPage: React.Dispatch<React.SetStateAction<number>> = React.useCallback(
    (v) => {
      pager.setPage(typeof v === "function" ? (v as (p: number) => number)(pager.page) : v);
    },
    [pager],
  );
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [completeTarget, setCompleteTarget] =
    React.useState<AdmCaseRow | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const setQuery = React.useCallback((v: string) => {
    setQueryInput(v);
  }, []);

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const setElig = React.useCallback(
    (v: "all" | AdmEligibility) => {
      setEligState(v);
      pager.setFilters({ eligibility: v === "all" ? undefined : v });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
    onMutate: async ({ id }) => {
      // Optimistic removal with rollback on error.
      await queryClient.cancelQueries({ queryKey: ["coordinator-enrolled"] });
      const previous = queryClient.getQueriesData({ queryKey: ["coordinator-enrolled"] });
      queryClient.setQueriesData<{ rows?: AdmCaseRow[] }>(
        { queryKey: ["coordinator-enrolled"] },
        (old) => (old && Array.isArray(old.rows) ? { ...old, rows: old.rows.filter((r) => r.id !== id) } : old),
      );
      return { previous };
    },
    onSuccess: (_data, vars) => {
      markSelfNotified(vars.id);
      invalidate();
      setCompleteTarget(null);
      toast.success({
        title: "Marked as completed",
        description: "Device return can now be recorded on the Devices page.",
      });
    },
    onError: (err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error({
        title: "Could not mark as completed",
        description: `${apiErrorMessage(err)} Changes were rolled back.`,
      });
    },
    onSettled: () => setCompletingId(null),
  });

  const hasActiveFilters = debounced !== "" || elig !== "all";
  const eligMenuLabel =
    ELIG_OPTIONS.find((o) => o.value === elig)?.label ?? "All statuses";

  function clearFilters() {
    setQueryInput("");
    setEligState("all");
    pager.setFilters({ q: undefined, eligibility: undefined });
  }

  const total = enrolledQuery.data?.total ?? 0;
  const totalPages = enrolledQuery.data?.totalPages ?? 1;

  const safePage = Math.min(page, totalPages);
  const limit = enrolledQuery.data?.limit ?? ENROLLED_PAGE_SIZE;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);

  // Prefetch the next page while the user views the current one.
  React.useEffect(() => {
    if (page >= totalPages) return;
    void queryClient.prefetchQuery({
      queryKey: ["coordinator-enrolled", page + 1, debounced, elig, ENROLLED_PAGE_SIZE],
      queryFn: ({ signal }) =>
        fetchCoordinatorReferrals(page + 1, {
          q: debounced || undefined,
          stage: "enrollment_monitoring",
          eligibility: elig,
          limit: ENROLLED_PAGE_SIZE,
          signal,
        }),
      staleTime: 30_000,
    });
  }, [queryClient, page, debounced, elig, totalPages]);

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
    setElig,
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
