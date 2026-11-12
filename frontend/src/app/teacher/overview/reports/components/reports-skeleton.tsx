"use client";

import {
  KanbanBoardSkeleton,
} from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./reports.module.css";

function StatColumns({ count }: { count: number }) {
  return (
    <div className={styles.statGrid} style={{ ["--cols" as string]: count }} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.statColumn}>
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className={styles.statCard}>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="size-9 rounded-full" />
            </div>
            <Skeleton className="mt-1 h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Class performance table: one header strip + learner-class rows. */
function ClassTableSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-6 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/* Distribution: five vertical bars (label / track / pills replaced by a chart). */
function DistributionSkeleton() {
  return (
    <div className={styles.skeletonBars} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full rounded-t-[4px] rounded-b-none"
          style={{ height: `${[80, 20, 24, 20, 92][i]}%` }}
        />
      ))}
    </div>
  );
}

/* Case activity: donut + three legend rows + referral status chips. */
function ActivitySkeleton() {
  return (
    <div className={styles.activityBody} aria-hidden>
      <Skeleton className="mx-auto aspect-square w-full max-w-[176px] rounded-full" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.activityLegendItem}>
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
      <div className={styles.chips}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-24 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/* Reserves the callout-shaped "What it means" footer. */
function BoardFooterSkeleton() {
  return (
    <div
      className="mt-auto flex flex-col gap-1.5 rounded-r-[6px] border-l-[3px] border-amber-500 bg-amber-500/10 px-3 py-2.5"
      aria-hidden
    >
      <Skeleton className="h-2.5 w-[88%]" />
      <Skeleton className="h-2.5 w-[62%]" />
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading term report">
      <StatColumns count={5} />
      <StatColumns count={6} />
      <div className={styles.panels}>
        <KanbanBoardSkeleton
          titleWidth="8.5rem"
          showDescription
          showCount
          footer={<BoardFooterSkeleton />}
        >
          <DistributionSkeleton />
        </KanbanBoardSkeleton>
        <KanbanBoardSkeleton
          titleWidth="7rem"
          showDescription
          showCount
          footer={<BoardFooterSkeleton />}
        >
          <ActivitySkeleton />
        </KanbanBoardSkeleton>
      </div>
      <KanbanBoardSkeleton titleWidth="10rem" showDescription>
        <ClassTableSkeleton />
      </KanbanBoardSkeleton>
    </div>
  );
}
