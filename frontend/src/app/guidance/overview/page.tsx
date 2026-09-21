"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceOverviewKpis } from "./components/guidance-overview-kpis";
import { GuidanceOverviewRiskCharts } from "./components/guidance-overview-risk-charts";
import { GuidanceOverviewCaseloadCharts } from "./components/guidance-overview-caseload-charts";
import { GuidanceOverviewGradeTable } from "./components/guidance-overview-grade-table";
import { fetchGuidanceOverview } from "./components/guidance-overview-data";
import styles from "./components/guidance-overview.module.css";

export default function GuidanceOverviewPage() {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: ["guidance-overview"],
    queryFn: fetchGuidanceOverview,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelTopRow}>
          <div className={styles.skelTopKpis}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.skelKpiCard}>
                <Skeleton className={styles.skelKpiLabel} />
                <Skeleton className={styles.skelKpiValue} />
                <Skeleton className={styles.skelKpiHint} />
              </div>
            ))}
          </div>

          <div className={styles.skelCard}>
            <div className={styles.skelCardHeadRow}>
              <div className={styles.skelCardHeadText}>
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelCardDesc} />
              </div>
              <Skeleton className={styles.skelBtn} />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className={styles.skelTableRow} />
            ))}
            <Skeleton className={styles.skelInterpretation} />
          </div>
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelChartGrid3}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelCardDesc} />
              <Skeleton className={styles.skelChart} />
              {i === 0 ? (
                <div className={styles.skelLegend}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} className={styles.skelLegendRow}>
                      <Skeleton className={styles.skelLegendLabel} />
                      <Skeleton className={styles.skelLegendCount} />
                    </div>
                  ))}
                </div>
              ) : null}
              <Skeleton className={styles.skelInterpretation} />
            </div>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.skelChartGrid2}>
          <div className={styles.skelCard}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelCardDesc} />
            <Skeleton className={styles.skelChart} />
            <div className={styles.skelLegend}>
              {[0, 1].map((j) => (
                <div key={j} className={styles.skelLegendRow}>
                  <Skeleton className={styles.skelLegendLabel} />
                  <Skeleton className={styles.skelLegendCount} />
                </div>
              ))}
            </div>
            <Skeleton className={styles.skelInterpretation} />
          </div>
          <div className={styles.skelCard}>
            <Skeleton className={styles.skelCardTitle} />
            <Skeleton className={styles.skelCardDesc} />
            <Skeleton className={styles.skelChartTall} />
            <Skeleton className={styles.skelInterpretation} />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the guidance overview.</p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <div className={styles.topKpis}>
          <GuidanceOverviewKpis kpis={data.kpis} />
        </div>
        <div className={styles.topMain}>
          <GuidanceOverviewGradeTable rows={data.gradeAttention} />
        </div>
      </div>

      <hr className={styles.divider} />

      <GuidanceOverviewRiskCharts
        riskByLevel={data.riskByLevel}
        factorTotals={data.factorTotals}
        riskByGrade={data.riskByGrade}
      />

      <hr className={styles.divider} />

      <GuidanceOverviewCaseloadCharts
        referralsByType={data.referralsByType}
        sectionHeat={data.sectionHeat}
      />
    </section>
  );
}
