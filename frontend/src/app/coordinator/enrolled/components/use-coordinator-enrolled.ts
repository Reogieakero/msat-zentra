"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  fetchCoordinatorReferrals,
  apiErrorMessage,
  type AdmCaseRow,
  type AdmEligibility,
  type AdmReferralsPage,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { ELIG_OPTIONS } from "./coordinator-enrolled-constants";

export type EnrolledStageTab = "enrollment_monitoring" | "completion";

export interface CoordinatorEnrolledModel {
  now: number;
  rows: AdmCaseRow[];
  total: number;
  totalPages: number;
  safePage: number;
  limit: number;
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
  stageTab: EnrolledStageTab;
  setStageTab: (v: EnrolledStageTab) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
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
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [elig, setElig] = React.useState<"all" | AdmEligibility>("all");
  const [stageTab, setStageTab] =
    React.useState<EnrolledStageTab>("enrollment_monitoring");
  const [page, setPage] = React.useState(1);
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [completeTarget, setCompleteTarget] =
    React.useState<AdmCaseRow | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  // Skip the mount fire: the initial "" debounce must not reset page 1.
  const prevDebouncedRef = React.useRef(debounced);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim();
      if (next === prevDebouncedRef.current) return;
      prevDebouncedRef.current = next;
      setDebounced(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const enrolledQuery = useQuery({
    queryKey: ["coordinator-enrolled", stageTab, page, debounced, elig],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(page, {
        q: debounced || undefined,
        stage: stageTab,
        eligibility: elig,
        signal,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Enrolled = approved by the Principal. Guard against any unapproved
  // row leaking through (e.g. stale cache from before signing).
  // Eligibility itself is filtered server-side (?eligibility=).
  const rows = React.useMemo(() => {
    const all = enrolledQuery.data?.rows ?? [];
    return all.filter((r) => r.approvedBy);
  }, [enrolledQuery.data]);

  const dropRowFromEnrolledCache = (id: string) => {
    // A completed case leaves the monitoring tab immediately — patch every
    // cached enrolled page instead of waiting for the refetch.
    queryClient.setQueriesData<AdmReferralsPage>(
      { queryKey: ["coordinator-enrolled"] },
      (cached) => {
        if (!cached || !Array.isArray(cached.rows)) return cached;
        if (!cached.rows.some((r) => r.id === id)) return cached;
        const rows = cached.rows.filter((r) => r.id !== id);
        return { ...cached, rows, total: Math.max(0, cached.total - 1) };
      },
    );
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-enrolled"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
  };

  const completeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "completion",
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      dropRowFromEnrolledCache(vars.id);
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
    setQuery("");
    setElig("all");
    setPage(1);
  }

  const total = enrolledQuery.data?.total ?? 0;
  const totalPages = enrolledQuery.data?.totalPages ?? 1;
  const safePage = Math.min(page, totalPages);
  const limit = enrolledQuery.data?.limit ?? 20;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);

  return {
    now,
    rows,
    total,
    totalPages,
    safePage,
    limit,
    start,
    end,
    enrolledPending: enrolledQuery.isPending,
    enrolledError: enrolledQuery.isError,
    enrolledRefetching: enrolledQuery.isRefetching,
    enrolledBackground: enrolledQuery.isFetching && !enrolledQuery.isPending,
    refetchEnrolled: () => {
      void enrolledQuery.refetch();
    },
    query,
    setQuery,
    debounced,
    elig,
    setElig: (v: "all" | AdmEligibility) => {
      setElig(v);
      setPage(1);
    },
    stageTab,
    setStageTab: (v: EnrolledStageTab) => {
      setStageTab(v);
      setPage(1);
    },
    page,
    setPage,
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
