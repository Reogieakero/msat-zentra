"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { NurseOverviewKpis } from "./components/NurseOverviewKpis";
import { NurseNeedsReviewPanel } from "./components/NurseOverviewQueues";
import { NurseOverviewBreakdown } from "./components/NurseOverviewBreakdown";
import { NurseOverviewTrends } from "./components/NurseOverviewTrends";
import { NurseRefreshBadge } from "../components/nurse-refresh-badge";
import {
  fetchNurseOverview,
  type NurseOverviewData,
} from "./components/nurse-overview-data";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/nurse-overview.module.css";

export default function NurseOverviewPage() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { data, isPending, isError, refetch, isFetching } =
    useQuery<NurseOverviewData>({
      queryKey: ["nurse-overview", "preview", termKey],
      queryFn: ({ signal }) => fetchNurseOverview(signal),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });

  if (isPending) {
    // Skeleton mirrors the real layout one-to-one (teacher body grid: main
    // data-table card + sticky side card, then breakdown + trends) so
    // nothing shifts when the data arrives.
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.body}>
          <div className={styles.mainCol}>
            <div className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative">
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              </div>
              <div className="relative overflow-x-auto rounded-md border p-2">
                <div className={styles.skelThead} aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className={styles.skelTheadCell} />
                  ))}
                </div>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <Skeleton key={i} className={styles.skelRow} />
                ))}
              </div>
            </div>
          </div>

          <aside className={styles.sideCol} style={{ top: "4rem" }}>
            <div className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative">
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              </div>
              <div className="relative flex flex-col gap-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1">
                      <Skeleton className={styles.skelKpiLabel} />
                      <Skeleton className={styles.skelKpiHint} aria-hidden="true" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <hr className={styles.divider} />

        <div className={styles.threeCol}>
          {[0, 1, 2].map((col) => (
            <div key={col} className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative">
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              </div>
              <div className="relative">
                <Skeleton className={styles.skelLine} aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

        <hr className={styles.divider} />

        <div className={styles.twoCol}>
          {[0, 1].map((col) => (
            <div key={col} className={assign.card}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative">
                <Skeleton className={styles.skelCardTitle} />
                <Skeleton className={styles.skelPanelDesc} aria-hidden="true" />
              </div>
              <div className="relative">
                <Skeleton className={styles.skelLine} aria-hidden="true" />
              </div>
            </div>
          ))}
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

  // Background refetch (staleTime expiry, realtime invalidate, focus):
  // keep existing data visible + a subtle non-blocking indicator.
  const refreshing = isFetching && !isPending;

  return (
    <section className={styles.page} aria-busy={refreshing}>
      {/* Floating pill — never shifts the content. */}
      {refreshing ? <NurseRefreshBadge label="Refreshing overview…" /> : null}
      {/* Teacher overview layout: main data-table column + sticky right
          rail of cards. Same grid, same sticky offset, same card shell. */}
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <NurseNeedsReviewPanel needsReview={data.needsReview} />
        </div>

        <aside className={styles.sideCol} style={{ top: "4rem" }}>
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
