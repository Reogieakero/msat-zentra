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
import { useDock } from "@/components/dock/dock-store";
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
  const dock = useDock();
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

  // Completed ADM cases fill the board's "Complete" lane (page 1 — the lane
  // is a short tail, monitoring keeps the pager). Without this the lane only
  // meant "all modules submitted" and a confirmed case simply vanished.
  const completedQuery = useQuery({
    queryKey: ["coordinator-enrolled", "completed", debounced, elig, ENROLLED_PAGE_SIZE],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(1, {
        q: debounced || undefined,
        stage: "completion",
        eligibility: elig,
        limit: ENROLLED_PAGE_SIZE,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const rows = React.useMemo(() => {
    const monitoring = Array.isArray(enrolledQuery.data?.rows)
      ? enrolledQuery.data.rows
      : [];
    const completed = Array.isArray(completedQuery.data?.rows)
      ? completedQuery.data.rows
      : [];
    const seen = new Set(monitoring.map((r) => r.id));
    return [
      ...monitoring.filter((r) => r.approvedBy),
      ...completed.filter((r) => r.approvedBy && !seen.has(r.id)),
    ];
  }, [enrolledQuery.data, completedQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-enrolled"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
  };

  const completeMutation = useMutation({
    mutationFn: async ({ id }: { id: string; student: string }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "completion",
      });
      return data;
    },
    onMutate: async ({ id, student }) => {
      // Optimistic move to the Complete lane with rollback on error.
      await queryClient.cancelQueries({ queryKey: ["coordinator-enrolled"] });
      const previous = queryClient.getQueriesData({ queryKey: ["coordinator-enrolled"] });
      queryClient.setQueriesData<{ rows?: AdmCaseRow[] }>(
        { queryKey: ["coordinator-enrolled"] },
        (old) =>
          old && Array.isArray(old.rows)
            ? {
                ...old,
                rows: old.rows.map((r) =>
                  r.id === id ? { ...r, stage: "completion" } : r,
                ),
              }
            : old,
      );
      // Report through the shared bottom-right Dock instead of a toast.
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "adm-complete",
          title: "Marking case completed",
          description: `${student} → completion`,
        });
      } catch {
        taskId = null;
      }
      return { previous, taskId };
    },
    onSuccess: (_data, vars, context) => {
      markSelfNotified(vars.id);
      invalidate();
      if (context?.taskId) {
        dock.completeTask(context.taskId, "Moved to the Complete lane");
      }
    },
    onError: (err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      if (context?.taskId) {
        dock.failTask(context.taskId, apiErrorMessage(err));
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
    enrolledPending: enrolledQuery.isPending || completedQuery.isPending,
    enrolledError: enrolledQuery.isError || completedQuery.isError,
    enrolledRefetching: enrolledQuery.isRefetching || completedQuery.isRefetching,
    enrolledBackground:
      (enrolledQuery.isFetching && !enrolledQuery.isPending) ||
      (completedQuery.isFetching && !completedQuery.isPending),
    refetchEnrolled: () => {
      void enrolledQuery.refetch();
      void completedQuery.refetch();
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
        const row = completeTarget;
        setCompletingId(row.id);
        // Close the overlay at once — the Dock reports the request.
        setCompleteTarget(null);
        completeMutation.mutate({ id: row.id, student: row.student });
      }
    },
  };
}
