"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fetchCoordinatorReferrals } from "@/services/coordinator/overview.service";
import type { AdmEligibility } from "@/services/coordinator/coordinator.types";
import { ELIG_OPTIONS } from "./coordinator-referrals-constants";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

export const COORDINATOR_PAGE_SIZE = PAGE_SIZE;

export function useCoordinatorFilters() {
  const searchParams = useSearchParams();
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
  const referralsQuery = useQuery({
    queryKey: ["coordinator-referrals", page, debounced, elig, COORDINATOR_PAGE_SIZE],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(page, {
        q: debounced || undefined,
        eligibility: elig,
        limit: COORDINATOR_PAGE_SIZE,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const rows = Array.isArray(referralsQuery.data?.rows)
    ? referralsQuery.data.rows
    : [];
  const hasActiveFilters = debounced !== "" || elig !== "all";
  const eligMenuLabel =
    ELIG_OPTIONS.find((o) => o.value === elig)?.label ?? "All statuses";
  function clearFilters() {
    setQuery("");
    setElig("all");
    setPage(1);
  }
  const total = referralsQuery.data?.total ?? 0;
  const totalPages = referralsQuery.data?.totalPages ?? 1;
  const safePage = Math.min(page, totalPages);
  const limit = referralsQuery.data?.limit ?? COORDINATOR_PAGE_SIZE;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);
  const stageCounts = referralsQuery.data?.stageCounts ?? {};
  const totalReferred =
    referralsQuery.data?.unfilteredTotal ?? referralsQuery.data?.totalReferred ?? 0;
  return {
    query: queryInput,
    setQuery,
    debounced,
    elig,
    setElig,
    page,
    setPage,
    hasActiveFilters,
    eligMenuLabel,
    clearFilters,
    referralsQuery,
    rows,
    total,
    totalPages,
    safePage,
    limit,
    start,
    end,
    stageCounts,
    totalReferred,
    isInitialLoading: referralsQuery.isPending,
    isSyncing: referralsQuery.isFetching && !referralsQuery.isPending,
    referralsError: referralsQuery.isError || !referralsQuery.data,
    referralsRefetching: referralsQuery.isRefetching,
    refetchReferrals: () => {
      void referralsQuery.refetch();
    },
  };
}
