"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseOverviewKpis } from "./components/NurseOverviewKpis";
import { NurseNeedsReviewPanel } from "./components/NurseOverviewQueues";
import { NurseOverviewBreakdown } from "./components/NurseOverviewBreakdown";
import { NurseOverviewTrends } from "./components/NurseOverviewTrends";
import { fetchNurseOverview } from "./components/nurse-overview-data";
import { useQuery } from "@tanstack/react-query";
import styles from "./components/nurse-overview.module.css";

export default function NurseOverviewPage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["nurse-overview"],
    queryFn: fetchNurseOverview,
    staleTime: 60_000,
  });

  if (isPending) {
    // Skeleton mirrors the real layout one-to-one (same grid, same cards,
    // same headers/descs/thead, same dividers and sections) so nothing
    // shifts when the data arrives.
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.topRow}>
          <div className={styles.mainCol}>
            <Card className={`${styles.panel} ${styles.skelPanel} ${styles.needsPanel}`}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              <div className={styles.skelThead} aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className={styles.skelTheadCell} />
                ))}
              </div>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className={styles.skelRow} />
              ))}
            </Card>
          </div>

          <div className={styles.kpiRail}>
            <div className={styles.kpiGrid}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Card key={i} size="sm" className={styles.card}>
                  <CardContent className={styles.skelKpiBody}>
                    <Skeleton className={styles.skelKpiLabel} />
                    <Skeleton className={styles.skelKpiValue} />
                    <Skeleton className={styles.skelKpiHint} aria-hidden="true" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <hr className={styles.divider} />

        <div className={styles.threeCol}>
          <Card className={`${styles.panel} ${styles.skelPanel}`}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
            <div className={styles.skelChartRow}>
              <Skeleton className={styles.skelDonut} />
              <div className={styles.skelLegend}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className={styles.skelLegendRow} />
                ))}
              </div>
            </div>
          </Card>
          {[1, 2].map((col) => (
            <Card key={col} className={`${styles.panel} ${styles.skelPanel}`}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              <div className={styles.skelBars}>
                {[82, 64, 50, 36, 24].map((w) => (
                  <div key={w} className={styles.skelBarRowWrap} aria-hidden="true">
                    <Skeleton className={styles.skelBarYLabel} />
                    <Skeleton className={styles.skelBarRow} style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
              <Skeleton className={styles.skelBarTotal} aria-hidden="true" />
            </Card>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.twoCol}>
          <Card className={`${styles.panel} ${styles.skelPanel}`}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
            <Skeleton className={styles.skelLine} aria-hidden="true" />
          </Card>
          <Card className={`${styles.panel} ${styles.skelPanel}`}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
            <div className={styles.skelBars}>
              {[72, 54, 38, 26].map((w) => (
                <div key={w} className={styles.skelBarRowWrap} aria-hidden="true">
                  <Skeleton className={styles.skelBarYLabel} />
                  <Skeleton className={styles.skelBarRow} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>We couldn&apos;t load the clinic overview</p>
          <p className={styles.pageErrorHint}>
            Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <div className={styles.mainCol}>
          <NurseNeedsReviewPanel needsReview={data.needsReview} />
        </div>

        <aside className={styles.kpiRail}>
          <NurseOverviewKpis kpis={data.kpis} />
        </aside>
      </div>

      <hr className={styles.divider} />

      <NurseOverviewBreakdown
        statusBreakdown={data.statusBreakdown}
        clinicStatusBreakdown={data.clinicStatusBreakdown}
        admStatusBreakdown={data.admStatusBreakdown}
      />

      <hr className={styles.divider} />

      <NurseOverviewTrends dailyTrend={data.dailyTrend} needsReview={data.needsReview} />
    </section>
  );
}
