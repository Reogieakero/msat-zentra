"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoardSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidanceOverviewKpiRail } from "./components/guidance-overview-kpi-rail";
import { GuidanceOverviewGradeTable } from "./components/guidance-overview-grade-table";
import { GuidanceOverviewRiskCharts } from "./components/guidance-overview-risk-charts";
import { GuidanceOverviewCaseloadCharts } from "./components/guidance-overview-caseload-charts";
import { fetchGuidanceOverview } from "@/services/guidance/overview.service";
import type { GuidanceOverviewData } from "@/services/guidance/overview.types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/guidance-overview.module.css";

export default function GuidanceOverviewPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { data, isPending, isError, refetch, isFetching } =
    useQuery<GuidanceOverviewData>({
      queryKey: ["guidance-overview", "preview", termKey],
      queryFn: ({ signal }) => fetchGuidanceOverview(signal),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  if (isPending) {
    return (
      <section
        className={styles.page}
        aria-busy="true"
        aria-label="Loading guidance overview"
      >
        <div className={styles.body}>
          <div className={styles.mainCol}>
            {/* Grade attention — real KanbanBoard shell + flat grade rows. */}
            <KanbanBoardSkeleton
              titleWidth="14rem"
              rows={0}
              showDescription
              actions={<Skeleton className="h-4 w-12 shrink-0" />}
            >
              <ul className={styles.caseList}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className={styles.caseRow} aria-hidden="true">
                    <div className={styles.rowLink}>
                      <div className={styles.caseInfo}>
                        <Skeleton className="size-8 shrink-0 rounded-md" />
                        <Skeleton className="h-4 w-24 min-w-0" />
                        <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
                      </div>
                      <div className={styles.sectionGroup}>
                        <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
                        <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
                      </div>
                      <div className={styles.cellActions}>
                        <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                        <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </KanbanBoardSkeleton>

            <div className={styles.threeCol}>
              {[0, 1, 2].map((col) => (
                <KanbanBoardSkeleton
                  key={col}
                  titleWidth="10rem"
                  rows={0}
                  showCount
                  showDescription
                  className="flex-1"
                >
                  {col === 0 ? (
                    <div className={styles.skelChartRow} aria-hidden="true">
                      <Skeleton className={styles.skelDonut} />
                      <div className={styles.skelLegend}>
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className={styles.skelLegendRow} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.skelBars} aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={styles.skelBarRowWrap}>
                          <Skeleton className={styles.skelBarYLabel} />
                          <Skeleton className={styles.skelBarRow} />
                        </div>
                      ))}
                    </div>
                  )}
                </KanbanBoardSkeleton>
              ))}
            </div>

            <div className={styles.twoCol}>
              {[0, 1].map((col) => (
                <KanbanBoardSkeleton
                  key={col}
                  titleWidth="10rem"
                  rows={0}
                  showCount
                  showDescription
                  className="flex-1"
                >
                  {col === 0 ? (
                    <div className={styles.skelChartRow} aria-hidden="true">
                      <Skeleton className={styles.skelDonut} />
                      <div className={styles.skelLegend}>
                        {[0, 1].map((i) => (
                          <Skeleton key={i} className={styles.skelLegendRow} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Skeleton className={styles.skelLine} aria-hidden="true" />
                  )}
                </KanbanBoardSkeleton>
              ))}
            </div>
          </div>

          <div className={styles.skelRail}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={styles.skelRailIcon} aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.pageError} role="alert">
          <p className={styles.pageErrorTitle}>
            We couldn&apos;t load the guidance overview
          </p>
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

  const refreshing = isFetching && !isPending;

  return (
    <section
      className={styles.page}
      aria-busy={refreshing}
      aria-label="Guidance overview"
    >
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <GuidanceOverviewGradeTable rows={data.gradeAttention} />

          {/* Charts stay inside the left column — the sticky icon rail owns
              the right strip, so no section may cross into it. */}
          <GuidanceOverviewRiskCharts
            riskByLevel={data.riskByLevel}
            factorTotals={data.factorTotals}
            riskByGrade={data.riskByGrade}
          />

          <GuidanceOverviewCaseloadCharts
            referralsByType={data.referralsByType}
            sectionHeat={data.sectionHeat}
          />
        </div>

        <GuidanceOverviewKpiRail
          kpis={data.kpis}
          referralsQueue={data.referralsQueue ?? []}
        />
      </div>
    </section>
  );
}
