"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceOverviewHeader } from "./components/guidance-overview-header";
import { GuidanceOverviewKpis } from "./components/guidance-overview-kpis";
import { GuidanceOverviewRiskCharts } from "./components/guidance-overview-risk-charts";
import { GuidanceOverviewCaseloadCharts } from "./components/guidance-overview-caseload-charts";
import { GuidanceOverviewGradeTable } from "./components/guidance-overview-grade-table";
import { GuidanceOverviewQueues } from "./components/guidance-overview-queues";
import { fetchGuidanceOverview } from "./components/guidance-overview-data";
import styles from "./components/guidance-overview.module.css";

export default function GuidanceOverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["guidance-overview"],
    queryFn: fetchGuidanceOverview,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHead}>
          <div className={styles.skelHeadText}>
            <Skeleton className={styles.skelEyebrow} />
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelLede} />
            <Skeleton className={styles.skelLede} />
          </div>
          <Skeleton className={styles.skelBadge} />
        </div>

        <div className={styles.skelKpiGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skelKpiCard}>
              <Skeleton className={styles.skelKpiLabel} />
              <Skeleton className={styles.skelKpiValue} />
              <Skeleton className={styles.skelKpiHint} />
            </div>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelChartGrid3}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelChart} />
              <Skeleton className={styles.skelLineShort} />
            </div>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelChartGrid2}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelChartTall} />
              <Skeleton className={styles.skelLineShort} />
            </div>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelCard}>
          <Skeleton className={styles.skelCardTitle} />
          <Skeleton className={styles.skelCardDesc} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className={styles.skelTableRow} />
          ))}
        </div>

        <div className={styles.skelQueueGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelQueueItem} />
              <Skeleton className={styles.skelQueueItem} />
              <Skeleton className={styles.skelQueueItem} />
              <Skeleton className={styles.skelBtn} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the guidance overview.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <GuidanceOverviewHeader counselorName={data.counselorName} />

      <GuidanceOverviewKpis kpis={data.kpis} />

      <hr className={styles.divider} />

      <GuidanceOverviewRiskCharts
        riskByLevel={data.riskByLevel}
        factorTotals={data.factorTotals}
        riskByGrade={data.riskByGrade}
      />

      <hr className={styles.divider} />

      <GuidanceOverviewCaseloadCharts
        anecdotalByCategory={data.anecdotalByCategory}
        sectionHeat={data.sectionHeat}
      />

      <hr className={styles.divider} />

      <GuidanceOverviewGradeTable rows={data.gradeAttention} />

      <GuidanceOverviewQueues
        referralsQueue={data.referralsQueue}
        interventionsQueue={data.interventionsQueue}
        admQueue={data.admQueue}
      />
    </section>
  );
}
