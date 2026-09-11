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
        <Skeleton className={styles.skelHeader} />
        <div className={styles.skelGrid}>
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
        </div>
        <Skeleton className={styles.skelRow} />
        <Skeleton className={styles.skelRow} />
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
      <GuidanceOverviewHeader counselorName={data.counselorName} termLabel={data.termLabel} />

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
