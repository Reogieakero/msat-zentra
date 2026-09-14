"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseOverviewHeader } from "./components/NurseOverviewHeader";
import { NurseOverviewKpis } from "./components/NurseOverviewKpis";
import { NurseOverviewQueues } from "./components/NurseOverviewQueues";
import { NurseOverviewBreakdown } from "./components/NurseOverviewBreakdown";
import { fetchNurseOverview } from "./components/nurse-overview-data";
import { useQuery } from "@tanstack/react-query";
import styles from "./components/nurse-overview.module.css";

export default function NurseOverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["nurse-overview"],
    queryFn: fetchNurseOverview,
    staleTime: 60_000,
  });

  if (isPending) {
    // Skeleton mirrors the real layout one-to-one (same grid, same cards,
    // same dividers and sections) so nothing shifts when the data arrives.
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHead}>
          <Skeleton className={styles.skelEyebrow} />
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelLede} />
        </div>

        <div className={styles.kpiGrid}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} size="sm" className={styles.card}>
              <CardContent className={styles.skelKpiBody}>
                <Skeleton className={styles.skelKpiLabel} />
                <Skeleton className={styles.skelKpiValue} />
              </CardContent>
            </Card>
          ))}
        </div>

        <hr className={styles.divider} />

        <Card className={`${styles.panel} ${styles.skelPanel}`}>
          <Skeleton className={styles.skelCardTitle} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={styles.skelRow} />
          ))}
        </Card>

        <Card className={`${styles.panel} ${styles.skelPanel}`}>
          <Skeleton className={styles.skelCardTitle} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={styles.skelRow} />
          ))}
        </Card>

        <hr className={styles.divider} />

        <div className={styles.twoCol}>
          {[0, 1].map((col) => (
            <Card key={col} className={`${styles.panel} ${styles.skelPanel}`}>
              <Skeleton className={styles.skelCardTitle} />
              <div className={styles.skelChartRow}>
                <Skeleton className={styles.skelDonut} />
                <div className={styles.skelLegend}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className={styles.skelLegendRow} />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the clinic overview.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <NurseOverviewHeader total={data.kpis.total} />

      <NurseOverviewKpis kpis={data.kpis} />

      <hr className={styles.divider} />

      <NurseOverviewQueues needsReview={data.needsReview} followUpsDue={data.followUpsDue} />

      <hr className={styles.divider} />

      <NurseOverviewBreakdown
        statusBreakdown={data.statusBreakdown}
        categoryBreakdown={data.categoryBreakdown}
      />
    </section>
  );
}
