"use client";

import { Pill } from "@/components/ui/pill";
import styles from "./guidance-adm-reports.module.css";

/**
 * Two-segment value pill — count, hairline divider, then the share in the
 * chart's amber accent. The shared `Pill` supplies the rectangle and the
 * hover/focus tooltip that explains the figures.
 */
export function GuidanceAdmValuePill({
  count,
  percent,
  label,
}: {
  count: number;
  percent: number;
  /** Field name shown in the pill's tooltip. */
  label: string;
}) {
  return (
    <Pill label={label} className="gap-0 p-0">
      <span className={styles.valuePillCount}>{count}</span>
      <span className={styles.valuePillPercent}>{percent}%</span>
    </Pill>
  );
}
