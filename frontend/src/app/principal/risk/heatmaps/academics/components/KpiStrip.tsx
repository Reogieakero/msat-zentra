"use client";

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
  if (isPending) {
    return (
      <div className={styles.kpiGrid} aria-hidden>
        <Skeleton className={styles.kpiSkel} />
        <Skeleton className={styles.kpiSkel} />
      </div>
    );
  }

  const belowPct =
    gradedTotal > 0 ? Math.round((below / gradedTotal) * 100) : 0;

  if (!isPending && sectionCount === 0 && gradedTotal === 0) return null;

  return (
    <div className={styles.kpiGrid}>
      <div className={styles.kpiCard}>
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
        <span className={styles.kpiValue}>{below.toLocaleString()}</span>
        <span className={styles.kpiLabel}>Students below 75</span>
        <span className={styles.kpiSub}>
          {belowPct}% of {gradedTotal.toLocaleString()} graded · live
        </span>
      </div>
      <div className={styles.kpiCard}>
        <span className={styles.glowClip} aria-hidden="true">
          <span className={styles.cardGlow} />
        </span>
        <span className={styles.kpiValue}>{riskySections}</span>
        <span className={styles.kpiLabel}>Sections at risk</span>
        <span className={styles.kpiSub}>of {sectionCount} sections · live</span>
      </div>
    </div>
  );
}
