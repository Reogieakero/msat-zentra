import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdmReferralsCohort } from "@/services/principal/adm.service";
import type { AdmReferralRow } from "@/services/principal/adm.types";

const STAGE = "principal_approval";

/**
 * One unfiltered endorsed-case cohort per term: the board searches and pages
 * in memory so typing is instant and never stacks a stale result set.
 */
export function useAdmReferralsList() {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["adm-referrals-cohort", STAGE], []);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAdmReferralsCohort(STAGE, signal),
    // Visited desks stay cached: back/forward navigation within the stale
    // window serves instantly with the skeleton only on genuine first loads.
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const rows = React.useMemo(
    () => (Array.isArray(query.data?.rows) ? query.data.rows : []),
    [query.data]
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

  return {
    rows,
    setRows,
    loading: query.isPending,
    isFetching: query.isFetching,
    error: query.isError ? "Failed to load referrals" : null,
    refetch: query.refetch,
    stage: STAGE,
  };
}
