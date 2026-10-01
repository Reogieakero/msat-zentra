"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/providers";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import {
  fetchNurseRiskFactors,
  fetchNurseRiskLevels,
} from "../alerts/components/nurse-alerts-data";
import { fetchNurseRisk } from "./components/nurse-risk-data";
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
import { buildRiskWatch, RiskWatchCard } from "./components/RiskWatch";
import { useNurseProfileSettings } from "../settings/components/profile-settings-data";
import styles from "@/components/risk-dashboard/risk-dashboard-page.module.css";

/**
 * Nurse risk dashboard — desk-scoped categories, levels, and heatmaps.
 * Every number derives from the nurse's own referrals plus the per-student
 * risk-level projection the nurse role may read. Counts and levels only;
 * confidential notes from other roles never appear here.
 */
export default function NurseRiskPage() {
  // Slice fills resolve per mode (SVG attributes can't read CSS vars), so
  // the dashboard rebuilds its palette whenever the theme flips.
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const riskQuery = useQuery({
    queryKey: ["nurse-risk"],
    queryFn: fetchNurseRisk,
    staleTime: 60_000,
  });

  // Saved settings hex — charts build their scale straight from it, so the
  // lines, donut, and bars always wear the user's chosen primary.
  const profile = useNurseProfileSettings();
  const primary = profile.data?.primaryColor ?? null;

  const studentIds = React.useMemo(
    () => [...new Set(Object.values(riskQuery.data?.referralToStudent ?? {}))],
    [riskQuery.data]
  );
  const levelsQuery = useQuery({
    queryKey: ["nurse-risk-levels", studentIds],
    queryFn: () => fetchNurseRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  const dashboard = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskDashboard(
            riskQuery.data.rows,
            levelsQuery.data ?? {},
            riskQuery.data.referralToStudent,
            isDark
          )
        : null,
    [riskQuery.data, levelsQuery.data, isDark]
  );

  // Factor flags behind the watch card — same students, same gate, so
  // drivers repaint with levels and the desk.
  const factorsQuery = useQuery({
    queryKey: ["nurse-risk-factors", studentIds],
    queryFn: () => fetchNurseRiskFactors(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  // Plain-words watch over the same desk rows the dashboard reads.
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

  const hotspot = React.useMemo(
    () =>
      dashboard
        ? findHotspot(dashboard.matrix, dashboard.matrixCategories, dashboard.totalCases)
        : null,
    [dashboard],
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
            })),
          )
        : null,
    [riskQuery.data],
  );

  const levelsPending = studentIds.length > 0 && levelsQuery.isPending;

  if (riskQuery.isPending || levelsPending) {
    // Skeleton mirrors the real layout one-to-one (page head, summary
    // strip, left rail cards + trend-lines panel with descs and
    // interpretations) so nothing shifts when data arrives.
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
          <p className={styles.eyebrow}>School Nurse · Insights</p>
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
      {refreshing ? <NurseRefreshBadge label="Refreshing risk dashboard…" /> : null}
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
            desk="clinic"
            mix={dashboard.levelMix}
            totalStudents={dashboard.totalStudents}
            interpretation={interpretLevelMix(dashboard.levelMix, dashboard.totalStudents, "clinic")}
            primary={primary}
          />
          <RiskCategories
            desk="clinic"
            rows={dashboard.categoryRows}
            interpretation={interpretCategoryMix(dashboard.categoryRows, dashboard.totalCases)}
            primary={primary}
          />
          </div>
        </div>
        <div className={styles.sideRail}>
          {watch ? <RiskWatchCard data={watch} /> : null}
          <RiskHotspot hotspot={hotspot} />
        </div>
      </div>
    </section>
  );
}
