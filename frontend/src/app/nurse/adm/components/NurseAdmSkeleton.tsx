"use client";

import * as React from "react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./nurse-adm.module.css";

/**
 * Loading skeleton for /nurse/adm — one shimmer board per live board, in the
 * same order and grids as the loaded page (findings strip → report charts →
 * bottlenecks/recommendations → risk boards → watchlist). Board shells come
 * from the real `KanbanBoard`, so paddings, borders and gaps match exactly
 * when data lands.
 */

/** Footer interpretation line — pinned to the board bottom like the real one. */
function InterpSkeleton() {
  return (
    <div className={styles.footerSlot}>
      <Skeleton className={styles.skelInterp} />
    </div>
  );
}

/** Board chrome placeholders shared by every card. */
function SkelBoard({
  children,
  footer,
  pillDesc = false,
  showCount = true,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Stats replace the text description with a tinted hint pill. */
  pillDesc?: boolean;
  /** KPI stat boards have no right-side count. */
  showCount?: boolean;
}) {
  return (
    <KanbanBoard
      title={<Skeleton className={styles.skelTitle} />}
      icon={<Skeleton className={styles.skelIcon} />}
      count={showCount ? <Skeleton className={styles.skelCount} /> : undefined}
      description={
        <Skeleton
          className={pillDesc ? styles.skelPill : styles.skelDesc}
        />
      }
      className="flex-1"
      footer={footer}
    >
      {children}
    </KanbanBoard>
  );
}

/** KPI finding card — the big number under the description pill. */
function StatBoard() {
  return (
    <SkelBoard pillDesc showCount={false}>
      <Skeleton className={styles.skelFindingValue} />
    </SkelBoard>
  );
}

function LegendRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.skelLegend}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={styles.skelLegendRow} />
      ))}
    </div>
  );
}

/** Donut + legend split — "Referred actions", "Students by risk level". */
function DonutBoard() {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <div className={styles.skelSplit}>
        <Skeleton className={styles.skelDonut} />
        <LegendRows rows={5} />
      </div>
    </SkelBoard>
  );
}

/** Category list — "Cases by category". */
function CategoryListBoard() {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <div className={styles.skelRowList}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelCategoryRow}>
            <Skeleton className={styles.skelCategoryLabel} />
            <Skeleton className={styles.skelCategoryBar} />
            <Skeleton className={styles.skelValuePill} />
          </div>
        ))}
      </div>
    </SkelBoard>
  );
}

/** Horizontal bar chart — "Risk cases by category" (bars end in count labels). */
function BarChartBoard() {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <div className={styles.skelRowList}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelCategoryRow}>
            <Skeleton className={styles.skelCategoryLabel} />
            <Skeleton className={styles.skelCategoryBar} />
            <Skeleton className={styles.skelBarValue} />
          </div>
        ))}
      </div>
    </SkelBoard>
  );
}

/** Line chart — "Referrals over time" (200px) and the taller risk trend. */
function LineBoard({ tall = false }: { tall?: boolean }) {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <Skeleton className={tall ? styles.skelLineTall : styles.skelLine} />
      {tall ? <LegendRows rows={4} /> : null}
    </SkelBoard>
  );
}

/** Waiting bottlenecks — response stats then the longest-waiting rows. */
function BottleneckBoard() {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <div className={styles.skelResponseStats}>
        {[0, 1].map((i) => (
          <div key={i} className={styles.skelResponseStat}>
            <Skeleton className={styles.skelResponseValue} />
            <Skeleton className={styles.skelResponseLabel} />
          </div>
        ))}
      </div>
      <div className={styles.skelRowList}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={styles.skelListRow} />
        ))}
      </div>
    </SkelBoard>
  );
}

/** Recommended actions — a short list of rows, no footer. */
function RecommendationsBoard() {
  return (
    <SkelBoard>
      <div className={styles.skelRowList}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={styles.skelListRow} />
        ))}
      </div>
    </SkelBoard>
  );
}

/** Who needs attention first — summary line + watchlist rows. */
function AttentionBoard() {
  return (
    <SkelBoard footer={<InterpSkeleton />}>
      <Skeleton className={styles.skelSummary} />
      <div className={styles.skelRowList}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={styles.skelListRow} />
        ))}
      </div>
    </SkelBoard>
  );
}

export function NurseAdmSkeleton() {
  return (
    <>
      {/* Key findings strip: four findings + busiest-spot stat. */}
      <div className={styles.findings} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <StatBoard key={i} />
        ))}
      </div>

      {/* Report charts: categories, referred actions, referrals over time. */}
      <div className={styles.threeCol} aria-hidden="true">
        <CategoryListBoard />
        <DonutBoard />
        <LineBoard />
      </div>

      {/* Bottlenecks + recommendations. */}
      <div className={styles.grid} aria-hidden="true">
        <BottleneckBoard />
        <RecommendationsBoard />
      </div>

      {/* Risk boards: levels, category bars, category trend. */}
      <div className={styles.grid} aria-hidden="true">
        <DonutBoard />
        <BarChartBoard />
      </div>
      <div aria-hidden="true">
        <LineBoard tall />
      </div>

      {/* Watchlist. */}
      <div aria-hidden="true">
        <AttentionBoard />
      </div>
    </>
  );
}
