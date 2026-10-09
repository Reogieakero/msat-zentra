import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdmReferrals } from "@/services/principal/adm.service";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PAGE_SIZE } from "@/components/shared/pagination";

const STAGE = "principal_approval";

export function useAdmReferralsList(search: string, page: number) {
  const queryClient = useQueryClient();
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const queryKey = React.useMemo(
    () => ["adm-referrals", debouncedSearch, page, STAGE],
    [debouncedSearch, page]
  );

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetchAdmReferrals(page, PAGE_SIZE, signal, debouncedSearch, STAGE),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const rows = React.useMemo(
    () => (Array.isArray(query.data?.rows) ? query.data.rows : []),
    [query.data]
  );
  const total = React.useMemo(() => {
    if (typeof query.data?.total === "number") return query.data.total;
    return rows.length;
  }, [query.data, rows.length]);
  const currentPage = React.useMemo(
    () => (typeof query.data?.page === "number" ? query.data.page : page),
    [query.data, page]
  );

  const setRows = React.useCallback(
    (updater: (prev: AdmReferralRow[]) => AdmReferralRow[]) => {
      queryClient.setQueryData(queryKey, (prev: unknown) => {
        const typed = prev as
          | { rows?: AdmReferralRow[]; total?: number; page?: number }
          | undefined;
        const nextRows = updater(
          Array.isArray(typed?.rows) ? typed.rows : []
        );
        return { ...(typed ?? {}), rows: nextRows };
      });
    },
    [queryClient, queryKey]
  );

  const load = React.useCallback(
    () => query.refetch(),
    [query]
  );

  const totalCount = total;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, totalCount);
  const loading = query.isPending;
  const error = query.isError ? "Failed to load referrals" : null;

  return {
    rows,
    setRows,
    total,
    totalCount,
    totalPages,
    safePage,
    start,
    end,
    pageSize: PAGE_SIZE,
    page: currentPage,
    loading,
    isFetching: query.isFetching,
    error,
    load,
    refetch: query.refetch,
    stage: STAGE,
  };
}
