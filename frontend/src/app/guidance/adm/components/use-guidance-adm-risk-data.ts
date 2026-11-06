"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchGuidanceRiskLevels } from "@/services/guidance/risk.service";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import {
  buildCategoryTrend,
  buildRiskDashboard,
  type CategoryTrend,
  type RiskDashboard,
} from "@/components/risk-dashboard/risk-dashboard-data";
import { fetchGuidanceRisk } from "../../risk/components/guidance-risk-dashboard";
import {
  buildGuidanceRiskWatch,
  fetchAllGuidanceAlertFactors,
  type RiskWatchData,
} from "../../risk/components/GuidanceRiskWatch";

export interface GuidanceAdmRiskData {
  isPending: boolean;
  dashboard: RiskDashboard | null;
  trend: CategoryTrend | null;
  watch: RiskWatchData | null;
}

/**
 * Shared risk data for the guidance ADM page. Query keys match the page's
 * existing risk-level lookup, so TanStack dedupes the extra network work.
 */
export function useGuidanceAdmRiskData(): GuidanceAdmRiskData {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const riskQuery = useQuery({
    queryKey: ["guidance-risk", termKey],
    queryFn: () => fetchGuidanceRisk(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: termReady,
  });

  const studentIds = React.useMemo(
    () =>
      [
        ...new Set(
          Object.values(riskQuery.data?.caseToStudent ?? {}).filter(
            (id): id is string => id !== null,
          ),
        ),
      ].sort(),
    [riskQuery.data],
  );

  const levelsQuery = useQuery<Record<string, GuidanceRiskLevel>>({
    queryKey: ["guidance-risk-levels", studentIds, termKey],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: termReady && studentIds.length > 0,
  });

  const factorsQuery = useQuery({
    queryKey: ["guidance-risk-alert-factors", termKey],
    queryFn: fetchAllGuidanceAlertFactors,
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: termReady,
  });

  const dashboard = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskDashboard(
            riskQuery.data.rows,
            levelsQuery.data ?? {},
            riskQuery.data.caseToStudent,
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
        ? buildGuidanceRiskWatch(
            riskQuery.data.rows,
            riskQuery.data.caseToStudent,
            riskQuery.data.referralToName,
            levelsQuery.data ?? {},
            factorsQuery.data ?? {},
          )
        : null,
    [riskQuery.data, levelsQuery.data, factorsQuery.data],
  );

  return { isPending: riskQuery.isPending, dashboard, trend, watch };
}
