"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/providers";
import {
  buildRiskDashboard,
  interpretCategoryMix,
  interpretLevelMix,
  interpretSectionMatrix,
} from "@/components/risk-dashboard/risk-dashboard-data";
import { RiskCategories } from "@/components/risk-dashboard/RiskCategories";
import { RiskHeatmap } from "@/components/risk-dashboard/RiskHeatmap";
import { RiskLevels } from "@/components/risk-dashboard/RiskLevels";
import { fetchGuidanceRiskLevels } from "../referrals/components/guidance-referrals-data";
import { fetchGuidanceRisk } from "./components/guidance-risk-dashboard";
import styles from "@/components/risk-dashboard/risk-dashboard-page.module.css";

/**
 * Guidance risk dashboard — desk-scoped categories, levels, and heatmaps.
 * Same shared UI as the nurse risk board; every number derives from the
 * guidance desk's own referrals plus the per-student risk-level projection
 * the guidance role may read. Counts and levels only; confidential notes
 * from other roles never appear here.
 */
export default function GuidanceRiskPage() {
  // Slice fills resolve per mode (SVG attributes can't read CSS vars), so
  // the dashboard rebuilds its palette whenever the theme flips.
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const riskQuery = useQuery({
    queryKey: ["guidance-risk"],
    queryFn: fetchGuidanceRisk,
    staleTime: 60_000,
  });

  // Track scope — the board mixes both referral tracks by default; the
  // switch isolates the Counseling caseload or the ADM consultation queue.
  const [track, setTrack] = React.useState<"all" | "Counseling" | "ADM">("all");
  const trackCounts = React.useMemo(() => {
    const rows = riskQuery.data?.rows ?? [];
    return {
      all: rows.length,
      Counseling: rows.filter((r) => r.track === "Counseling").length,
      ADM: rows.filter((r) => r.track === "ADM").length,
    };
  }, [riskQuery.data]);
  const filteredRows = React.useMemo(() => {
    const rows = riskQuery.data?.rows ?? [];
    return track === "all" ? rows : rows.filter((r) => r.track === track);
  }, [riskQuery.data, track]);

  const studentIds = React.useMemo(
    () => [
      ...new Set(
        filteredRows
          .map((r) => riskQuery.data?.caseToStudent[r.id] ?? null)
          .filter((id): id is string => id !== null)
      ),
    ],
    [filteredRows, riskQuery.data]
  );
  const levelsQuery = useQuery({
    queryKey: ["guidance-risk-levels", studentIds],
    queryFn: () => fetchGuidanceRiskLevels(studentIds),
    staleTime: 300_000,
    enabled: studentIds.length > 0,
  });

  const dashboard = React.useMemo(
    () =>
      riskQuery.data
        ? buildRiskDashboard(
            filteredRows,
            levelsQuery.data ?? {},
            riskQuery.data.caseToStudent,
            isDark
          )
        : null,
    [riskQuery.data, filteredRows, levelsQuery.data, isDark]
  );

  const levelsPending = studentIds.length > 0 && levelsQuery.isPending;

  if (riskQuery.isPending || levelsPending) {
    // Skeleton mirrors the real layout one-to-one (page head, heatmap
    // grid panel + donut/bars side rail with descs and interpretations)
    // so nothing shifts when data arrives.
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelPageHead} aria-hidden="true">
          <Skeleton className={styles.skelEyebrow} />
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelLede} />
        </div>
        <div className={styles.trackRow} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={styles.skelTrackBtn} />
          ))}
        </div>
        <div className={styles.mainGrid}>
          <Card>
            <CardContent className={styles.skelChartCard}>
              <Skeleton className={styles.skelLabel} />
              <Skeleton className={styles.skelDesc} aria-hidden="true" />
              <div className={styles.skelHeatScroll} aria-hidden="true">
                <div className={styles.skelHeatGrid}>
                  <div className={styles.skelHeatRow}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className={styles.skelHeatHeadCell} />
                    ))}
                  </div>
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className={styles.skelHeatRow}>
                      {[0, 1, 2, 3, 4].map((c) => (
                        <Skeleton key={c} className={styles.skelHeatCell} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.skelHeatFooter} aria-hidden="true">
                <Skeleton className={styles.skelHeatLegend} />
              </div>
              <Skeleton className={styles.skelInterp} aria-hidden="true" />
              <Skeleton className={styles.skelInterpShort} aria-hidden="true" />
            </CardContent>
          </Card>
          <div className={styles.sideRail}>
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

  return (
    <section className={styles.page}>
      <div>
        <p className={styles.eyebrow}>Guidance · Insights</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Risk dashboard</h1>
        </div>
        <p className={styles.lede}>
          Desk-scoped categories, levels, and heatmaps.
        </p>
      </div>
      <div className={styles.trackRow} role="group" aria-label="Filter board by case track">
        {(
          [
            { key: "all", label: "All tracks" },
            { key: "Counseling", label: "Counseling" },
            { key: "ADM", label: "ADM" },
          ] as const
        ).map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={track === t.key ? "default" : "outline"}
            onClick={() => setTrack(t.key)}
            aria-pressed={track === t.key}
          >
            {t.label} · {trackCounts[t.key]}
          </Button>
        ))}
      </div>
      <div className={styles.mainGrid}>
        <RiskHeatmap
          desk="guidance"
          categories={dashboard.matrixCategories}
          matrix={dashboard.matrix}
          colTotals={dashboard.colTotals}
          total={dashboard.totalCases}
          interpretation={interpretSectionMatrix(
            dashboard.matrix,
            dashboard.matrixCategories,
            dashboard.totalCases,
            "guidance"
          )}
        />
        <div className={styles.sideRail}>
          <RiskLevels
            desk="guidance"
            mix={dashboard.levelMix}
            totalStudents={dashboard.totalStudents}
            interpretation={interpretLevelMix(dashboard.levelMix, dashboard.totalStudents, "guidance")}
          />
          <RiskCategories
            desk="guidance"
            rows={dashboard.categoryRows}
            interpretation={interpretCategoryMix(dashboard.categoryRows, dashboard.totalCases, "guidance")}
          />
        </div>
      </div>
    </section>
  );
}
