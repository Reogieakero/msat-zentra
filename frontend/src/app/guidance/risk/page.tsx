"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/providers";
import { RefreshBadge } from "@/components/ui/refresh-badge";
import {
  buildCategoryTrend,
  buildRiskDashboard,
  interpretCategoryMix,
  interpretCategoryTrend,
  interpretLevelMix,
} from "@/components/risk-dashboard/risk-dashboard-data";
import { RiskCategories } from "@/components/risk-dashboard/RiskCategories";
import { RiskTrendLines } from "@/components/risk-dashboard/RiskTrendLines";
import { RiskLevels } from "@/components/risk-dashboard/RiskLevels";
import { findHotspot, RiskHotspot } from "@/components/risk-dashboard/RiskHotspot";
import {
  fetchGuidanceRiskLevels,
  type GuidanceRiskLevel,
} from "../referrals/components/guidance-referrals-data";
import { fetchGuidanceRisk } from "./components/guidance-risk-dashboard";
import {
  buildGuidanceRiskWatch,
  fetchAllGuidanceAlertFactors,
  GuidanceRiskWatchCard,
} from "./components/GuidanceRiskWatch";
import { useGuidanceProfileSettings } from "../settings/components/profile-settings-data";
import styles from "@/components/risk-dashboard/risk-dashboard-page.module.css";

/**
 * Guidance risk dashboard — desk-scoped categories, levels, and heatmaps.
 * Same contents and layout as the nurse risk board, over the guidance
 * desk's own referrals plus the per-student risk-level projection the
 * guidance role may read. Counts and levels only; confidential notes from
 * other roles never appear here.
 */
export default function GuidanceRiskPage() {
  // Slice fills resolve per mode (SVG attributes can't read CSS vars), so
  // the dashboard rebuilds its palette whenever the theme flips.
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const riskQuery = useQuery({
    queryKey: ["guidance-risk", termKey],
    queryFn: () => fetchGuidanceRisk(),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Saved settings hex — charts build their scale straight from it, so the
  // lines, donut, and bars always wear the user's chosen primary.
  const profile = useGuidanceProfileSettings();
  const primary = profile.data?.primaryColor ?? null;

  const studentIds = React.useMemo(
    () =>
      [...new Set(Object.values(riskQuery.data?.caseToStudent ?? {}).filter((id): id is string => id !== null))].sort(),
    [riskQuery.data]
  );
  const levelsQuery = useQuery<Record<string, GuidanceRiskLevel>>({
    queryKey: ["guidance-risk-levels", studentIds, termKey],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    placeholderData: keepPreviousData,
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  const dashboard = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskDashboard(
            riskQuery.data.rows,
            levelsQuery.data ?? {},
            riskQuery.data.caseToStudent,
            isDark
          )
        : null,
    [riskQuery.data, levelsQuery.data, isDark]
  );

  // Factor flags behind the watch card — same students, so drivers repaint
  // with levels and the desk.
  const factorsQuery = useQuery({
    queryKey: ["guidance-risk-alert-factors", termKey],
    queryFn: fetchAllGuidanceAlertFactors,
    placeholderData: keepPreviousData,
    staleTime: 300_000,
  });

  // Plain-words watch over the same desk rows the dashboard reads.
  const watch = React.useMemo(
    () =>
      riskQuery.data
        ? buildGuidanceRiskWatch(
            riskQuery.data.rows,
            riskQuery.data.caseToStudent,
            riskQuery.data.referralToName,
            levelsQuery.data ?? {},
            factorsQuery.data ?? {}
          )
        : null,
    [riskQuery.data, levelsQuery.data, factorsQuery.data]
  );

  const hotspot = React.useMemo(
    () =>
      dashboard
        ? findHotspot(dashboard.matrix, dashboard.matrixCategories, dashboard.totalCases)
        : null,
    [dashboard]
  );

  // Weekly category lines for the main panel — same desk rows, mapped to
  // the shared trend input (category + referred date).
  const trend = React.useMemo(
    () =>
      riskQuery.data
        ? buildCategoryTrend(
            riskQuery.data.rows.map((r) => ({
              category: r.category,
              referredAt: r.referredAt,
            }))
          )
        : null,
    [riskQuery.data]
  );

  const levelsPending = studentIds.length > 0 && levelsQuery.isPending;

  if (riskQuery.isPending || levelsPending) {
    // Skeleton mirrors the real layout one-to-one (trend-lines panel,
    // levels + categories duo, side rail) so nothing shifts when data
    // arrives.
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.mainGridFlipped}>
          <div className={styles.chartsCol}>
            <Card>
              <CardContent className={styles.skelChartCard}>
                <Skeleton className={styles.skelLabel} />
                <Skeleton className={styles.skelDesc} aria-hidden="true" />
                <div className={styles.skelBars}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className={styles.skelBar} />
                  ))}
                </div>
                <Skeleton className={styles.skelInterp} aria-hidden="true" />
                <Skeleton className={styles.skelInterpShort} aria-hidden="true" />
              </CardContent>
            </Card>
            <div className={styles.duoGrid}>
              <Card>
                <CardContent className={styles.skelChartCard}>
                  <Skeleton className={styles.skelLabel} />
                  <Skeleton className={styles.skelDesc} aria-hidden="true" />
                  <div className={styles.skelChartRow}>
                    <Skeleton className={styles.skelDonut} />
                    <div className={styles.skelLegend}>
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className={styles.skelLegendRow} />
                      ))}
                    </div>
                  </div>
                  <Skeleton className={styles.skelInterp} aria-hidden="true" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className={styles.skelChartCard}>
                  <Skeleton className={styles.skelLabel} />
                  <Skeleton className={styles.skelDesc} aria-hidden="true" />
                  <div className={styles.skelBars}>
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className={styles.skelBar} />
                    ))}
                  </div>
                  <Skeleton className={styles.skelInterp} aria-hidden="true" />
                </CardContent>
              </Card>
            </div>
          </div>
          <div className={styles.sideRail}>
            <Card aria-hidden="true">
              <CardContent className={styles.skelChartCard}>
                <Skeleton className={styles.skelLabel} />
                <Skeleton className={styles.skelDesc} aria-hidden="true" />
                <Skeleton className={styles.skelInterp} aria-hidden="true" />
              </CardContent>
            </Card>
            <Card aria-hidden="true">
              <CardContent className={styles.skelChartCard}>
                <Skeleton className={styles.skelLabel} />
                <Skeleton className={styles.skelDesc} aria-hidden="true" />
                <Skeleton className={styles.skelInterp} aria-hidden="true" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  if (riskQuery.isError || !riskQuery.data || !dashboard) {
    const retry = () => {
      void riskQuery.refetch();
      void levelsQuery.refetch();
    };
    const fetching = riskQuery.isFetching || levelsQuery.isFetching;
    return (
      <section className={styles.page}>
        <div>
          <p className={styles.eyebrow}>Guidance · Insights</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Risk dashboard</h1>
          </div>
        </div>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the risk dashboard</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button size="sm" variant="outline" disabled={fetching} onClick={retry}>
            {fetching ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const fetching = riskQuery.isFetching || levelsQuery.isFetching;

  const refreshing = !riskQuery.isPending && fetching;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {refreshing ? <RefreshBadge label="Refreshing risk dashboard…" /> : null}
      <div className={styles.mainGridFlipped}>
        <div className={styles.chartsCol}>
          {trend ? (
            <RiskTrendLines
              trend={trend}
              interpretation={interpretCategoryTrend(trend)}
              primary={primary}
            />
          ) : null}
          <div className={styles.duoGrid}>
            <RiskLevels
              desk="guidance"
              mix={dashboard.levelMix}
              totalStudents={dashboard.totalStudents}
              interpretation={interpretLevelMix(
                dashboard.levelMix,
                dashboard.totalStudents,
                "guidance"
              )}
              primary={primary}
            />
            <RiskCategories
              desk="guidance"
              rows={dashboard.categoryRows}
              interpretation={interpretCategoryMix(dashboard.categoryRows, dashboard.totalCases)}
              primary={primary}
            />
          </div>
        </div>
        <div className={styles.sideRail}>
          {watch ? <GuidanceRiskWatchCard data={watch} /> : null}
          <RiskHotspot hotspot={hotspot} />
        </div>
      </div>
    </section>
  );
}
