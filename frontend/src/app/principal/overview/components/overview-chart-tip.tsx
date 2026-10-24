"use client";

import * as React from "react";
import styles from "./overview-chart-tip.module.css";

interface PayloadItem {
  value?: unknown;
  name?: unknown;
  payload?: Record<string, unknown>;
}

/**
 * Shared friendly tooltip for every principal overview chart — one plain
 * language line ("Attendance — 12 learners flagged") instead of the raw
 * name/value pair recharts renders by default.
 */
export function FriendlyTooltip({
  active,
  payload,
  label,
  unit,
  fallbackName = "Students",
}: {
  active?: boolean;
  payload?: readonly PayloadItem[];
  label?: unknown;
  /** Trailing noun after the value, e.g. "learners flagged". */
  unit: string;
  fallbackName?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = Number(item?.value) || 0;
  // Order matters: category charts carry the name on `label` / the row, while
  // pie slices carry it on `name`. Never surface the raw dataKey ("value").
  const name =
    (typeof item?.payload?.label === "string" && (item.payload.label as string)) ||
    (typeof label === "string" && label) ||
    (typeof item?.name === "string" && item.name) ||
    fallbackName;
  return (
    <div className={styles.tip}>
      <span className={styles.tipLabel}>{name}</span>
      <span className={styles.tipValue}>
        {value}
        {unit ? <span className={styles.tipUnit}> {unit}</span> : null}
      </span>
    </div>
  );
}
