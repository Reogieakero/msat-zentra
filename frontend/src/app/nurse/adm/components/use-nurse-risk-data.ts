"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import {
  fetchNurseRisk,
  fetchNurseRiskFactors,
  fetchNurseRiskLevels,
} from "@/services/nurse/risk.service";
import type { NurseRiskLevel } from "@/services/nurse/nurse.types";
import {
  buildCategoryTrend,
  buildRiskDashboard,
  type CategoryTrend,
  type RiskDashboard,
} from "@/components/risk-dashboard/risk-dashboard-data";
import { buildRiskWatch, type RiskWatchData } from "./nurse-adm-risk-watch";

export interface NurseAdmRiskData {
  isPending: boolean;
  dashboard: RiskDashboard | null;
  trend: CategoryTrend | null;
  watch: RiskWatchData | null;
}

/**
 * Shared risk-dashboard data for the nurse ADM page. The query keys match
 * the page's other risk-level lookups, so TanStack dedupes the network work
 * when both the KPI stat and the risk section are mounted.
 */
export function useNurseAdmRiskData(): NurseAdmRiskData {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const riskQuery = useQuery({
    queryKey: ["nurse-risk", termKey],
    queryFn: ({ signal }) => fetchNurseRisk(signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: termReady,
  });

  const studentIds = React.useMemo(
    () =>
      [...new Set(Object.values(riskQuery.data?.referralToStudent ?? {}))].sort(),
    [riskQuery.data],
  );

  const levelsQuery = useQuery<Record<string, NurseRiskLevel>>({
    queryKey: ["nurse-risk-levels", studentIds, termKey],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: termReady && studentIds.length > 0,
  });

  const factorsQuery = useQuery({
    queryKey: ["nurse-risk-factors", studentIds, termKey],
    queryFn: () => fetchNurseRiskFactors(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: termReady && studentIds.length > 0,
  });

  const dashboard = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskDashboard(
            riskQuery.data.rows,
            levelsQuery.data ?? {},
            riskQuery.data.referralToStudent,
          )
        : null,
    [riskQuery.data, levelsQuery.data],
  );

  const trend = React.useMemo(
    () =>
      riskQuery.data
        ? buildCategoryTrend(
            riskQuery.data.rows.map((r) => ({
              category: r.category,
              referredAt: r.referredAt,
            })),
          )
        : null,
    [riskQuery.data],
  );

  const watch = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskWatch(
            riskQuery.data.rows,
            riskQuery.data.referralToStudent,
            levelsQuery.data ?? {},
            factorsQuery.data ?? {},
          )
        : null,
    [riskQuery.data, levelsQuery.data, factorsQuery.data],
  );

  return { isPending: riskQuery.isPending, dashboard, trend, watch };
}
