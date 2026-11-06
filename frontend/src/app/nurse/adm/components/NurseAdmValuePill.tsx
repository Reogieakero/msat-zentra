"use client";

import styles from "./nurse-adm.module.css";

/**
 * Two-segment value pill — count, hairline divider, then the share in the
 * chart's amber accent. Same recipe as the clinic overview's donut legend,
 * so every legend / category row reads the same way.
 */
export function AdmValuePill({
  count,
  percent,
}: {
  count: number;
  percent: number;
}) {
  return (
    <span className={styles.legendPill}>
      <span className={styles.legendPillCount}>{count}</span>
      <span className={styles.legendPillPercent}>{percent}%</span>
    </span>
  );
}
