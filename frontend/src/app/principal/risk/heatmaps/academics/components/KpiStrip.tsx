"use client";

import { Activity, TriangleAlert, Users } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./academics.module.css";

export function KpiStrip({
  below,
  gradedTotal,
  riskySections,
  sectionCount,
  isPending,
}: {
  below: number;
  gradedTotal: number;
  riskySections: number;
  sectionCount: number;
  isPending: boolean;
}) {
  const belowPct =
    gradedTotal > 0 ? Math.round((below / gradedTotal) * 100) : 0;

  if (!isPending && sectionCount === 0 && gradedTotal === 0) return null;

  return (
    <KanbanBoard
      title="Academic Overview"
      icon={<Activity size={14} aria-hidden="true" />}
      count={isPending ? undefined : sectionCount}
      description="Live transmuted averages across every section — grades update as teachers save scores, no finalized-only filter."
      ariaLabel="Academic overview"
    >
      {isPending ? (
        <div className={styles.kpiGrid} aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className={styles.kpiSkel} />
          ))}
        </div>
      ) : (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <TriangleAlert
                className={styles.kpiIconBad}
                size={16}
                aria-hidden
              />
              <span className={styles.kpiValue}>{below.toLocaleString()}</span>
            </span>
            <span className={styles.kpiLabel}>Students below 75</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">
                {belowPct}% of {gradedTotal.toLocaleString()} graded
              </Pill>
              <Pill tone="neutral">Live grades</Pill>
            </span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiTop}>
              <Users className={styles.kpiIconBad} size={16} aria-hidden />
              <span className={styles.kpiValue}>
                {riskySections.toLocaleString()}
              </span>
            </span>
            <span className={styles.kpiLabel}>Sections at risk</span>
            <span className={styles.kpiPills}>
              <Pill tone="neutral">
                Of {sectionCount.toLocaleString()} sections
              </Pill>
              <Pill tone="neutral">Live grades</Pill>
            </span>
          </div>
        </div>
      )}
    </KanbanBoard>
  );
}
