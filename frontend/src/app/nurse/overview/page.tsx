"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoardSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { NurseOverviewKpiRail } from "./components/NurseOverviewKpiRail";
import { NurseLatestReferralsPanel } from "./components/NurseOverviewQueues";
import { NurseOverviewBreakdown } from "./components/NurseOverviewBreakdown";
import { NurseOverviewTrends } from "./components/NurseOverviewTrends";
import { fetchNurseOverview } from "@/services/nurse/overview.service";
import type { NurseOverviewData } from "@/services/nurse/nurse.types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/nurse-overview.module.css";

export default function NurseOverviewPage() {
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { data, isPending, isError, refetch, isFetching } =
    useQuery<NurseOverviewData>({
      queryKey: ["nurse-overview", "preview", termKey],
      queryFn: ({ signal }) => fetchNurseOverview(signal),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
      enabled: termReady,
    });

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading clinic overview">
        <div className={styles.body}>
          <div className={styles.mainCol}>
            {/* Latest referred students — real KanbanBoard shell + flat case rows. */}
            <KanbanBoardSkeleton
              titleWidth="12rem"
              rows={0}
              showDescription
              actions={<Skeleton className="h-4 w-12 shrink-0" />}
            >
              <ul className={styles.caseList}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className={styles.caseRow} aria-hidden="true">
                    <div className={styles.caseInfo}>
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-40 min-w-0" />
                      <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
                      <Skeleton className="h-5 w-10 shrink-0 rounded-md" />
                      <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                    </div>
                    <div className={styles.cellActions}>
                      <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                      <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
                      <Skeleton className="h-5 w-12 shrink-0 rounded-md" />
                      <Skeleton className="size-7 shrink-0 rounded-md" />
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
                      {[0, 1, 2, 3].map((i) => (
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
                  <Skeleton className={styles.skelLine} aria-hidden="true" />
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

  const refreshing = isFetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing} aria-label="Clinic overview">
      <div className={styles.body}>
        <div className={styles.mainCol}>
          {/* ?? [] guards a stale in-memory cache entry built before the
              latestReferrals feed existed (dev hot reload / open tab). */}
          <NurseLatestReferralsPanel latestReferrals={data.latestReferrals ?? []} />

          {/* Charts stay inside the left column — the sticky icon rail owns
              the right strip, so no section may cross into it. */}
          <NurseOverviewBreakdown
            statusBreakdown={data.statusBreakdown}
            clinicStatusBreakdown={data.clinicStatusBreakdown}
            admStatusBreakdown={data.admStatusBreakdown}
          />

          <NurseOverviewTrends dailyTrend={data.dailyTrend} needsReview={data.needsReview} />
        </div>

        <NurseOverviewKpiRail
          kpis={data.kpis}
          needsReview={data.needsReview}
        />
      </div>
    </section>
  );
}
