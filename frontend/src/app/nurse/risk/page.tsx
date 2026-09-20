"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/providers";
import { fetchNurseRiskLevels } from "../alerts/components/nurse-alerts-data";
import {
  buildNurseRiskDashboard,
  fetchNurseRisk,
  interpretCategoryMix,
  interpretLevelMix,
  interpretSectionMatrix,
} from "./components/nurse-risk-data";
import { NurseRiskLevels } from "./components/NurseRiskLevels";
import { NurseRiskCategories } from "./components/NurseRiskCategories";
import { NurseRiskHeatmap } from "./components/NurseRiskHeatmap";
import styles from "./nurse-risk-page.module.css";

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
        ? buildNurseRiskDashboard(
            riskQuery.data.rows,
            levelsQuery.data ?? {},
            riskQuery.data.referralToStudent,
            isDark
          )
        : null,
    [riskQuery.data, levelsQuery.data, isDark]
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

  return (
    <section className={styles.page}>
      <div className={styles.mainGrid}>
        <NurseRiskHeatmap
          categories={dashboard.matrixCategories}
          matrix={dashboard.matrix}
          colTotals={dashboard.colTotals}
          total={dashboard.totalCases}
          interpretation={interpretSectionMatrix(
            dashboard.matrix,
            dashboard.matrixCategories,
            dashboard.totalCases
          )}
        />
        <div className={styles.sideRail}>
          <NurseRiskLevels
            mix={dashboard.levelMix}
            totalStudents={dashboard.totalStudents}
            interpretation={interpretLevelMix(dashboard.levelMix, dashboard.totalStudents)}
          />
          <NurseRiskCategories
            rows={dashboard.categoryRows}
            interpretation={interpretCategoryMix(dashboard.categoryRows, dashboard.totalCases)}
          />
        </div>
      </div>
    </section>
  );
}
