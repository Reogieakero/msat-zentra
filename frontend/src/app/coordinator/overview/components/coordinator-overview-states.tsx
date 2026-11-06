"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./coordinator-overview-states.module.css";

/** Footer interpretation shimmer, pinned to the board bottom like the callout. */
function InterpSkeleton() {
  return (
    <div className={styles.footerSlot}>
      <Skeleton className={styles.skelInterp} />
    </div>
  );
}

/** Shared board chrome — the real shell so nothing shifts when data lands. */
function SkelBoard({
  children,
  footer,
  showCount = true,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCount?: boolean;
}) {
  return (
    <KanbanBoard
      title={<Skeleton className={styles.skelTitle} />}
      icon={<Skeleton className={styles.skelIcon} />}
      count={showCount ? <Skeleton className={styles.skelCount} /> : undefined}
      description={<Skeleton className={styles.skelDesc} />}
      className="flex-1"
      footer={footer}
    >
      {children}
    </KanbanBoard>
  );
}

/**
 * Loading skeleton for /coordinator/overview — mirrors the loaded layout
 * board-for-board: the KPI strip, then the three-board section (stage donut,
 * learning devices, booked meetings) and the Recent forwards card grid.
 */
export function CoordinatorOverviewSkeleton() {
  return (
    <section className={styles.page} aria-busy="true">
      <div className={styles.kpiGrid} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.kpiColumn}>
            <div className={styles.kpiHeadSkeleton}>
              <Skeleton style={{ width: "8rem", height: "1rem" }} />
            </div>
            <div className={styles.kpiStat}>
              <div className={styles.kpiStatTop}>
                <Skeleton className={styles.kpiMascot} />
                <Skeleton style={{ width: "2rem", height: "1.5rem" }} />
              </div>
              <Skeleton style={{ width: "80%", height: "0.75rem" }} />
            </div>
            <Skeleton style={{ width: "5rem", height: "1.5rem", marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      {/* Cases by stage · Learning devices · Booked meetings. */}
      <div className={styles.boardGrid} aria-hidden="true">
        <SkelBoard footer={<InterpSkeleton />} showCount={false}>
          <div className={styles.skelDonutRow}>
            <Skeleton className={styles.skelDonut} />
            <div className={styles.skelLegend}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className={styles.skelLegendRow} />
              ))}
            </div>
          </div>
        </SkelBoard>

        <SkelBoard footer={<InterpSkeleton />} showCount={false}>
          <div className={styles.skelList}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={styles.skelListRow} />
            ))}
          </div>
        </SkelBoard>

        <SkelBoard footer={<InterpSkeleton />}>
          <div className={styles.skelList}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={styles.skelListRow} />
            ))}
          </div>
        </SkelBoard>
      </div>

      {/* Recent forwards board over its case-card grid. */}
      <div aria-hidden="true">
        <SkelBoard footer={<InterpSkeleton />} showCount={false}>
          <div className={styles.caseGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className={styles.caseCard} />
            ))}
          </div>
        </SkelBoard>
      </div>
    </section>
  );
}

export function CoordinatorOverviewError({
  onRetry,
  isRefetching,
}: {
  onRetry: () => void;
  isRefetching: boolean;
}) {
  return (
    <section className={styles.page}>
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the coordinator overview. Please check your
          internet connection and try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefetching}
          onClick={onRetry}
        >
          {isRefetching ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    </section>
  );
}
