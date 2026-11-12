"use client";

import * as React from "react";
import styles from "./chart-tooltip.module.css";

/** Wrapper style for recharts' `<Tooltip>` so it floats above board chrome. */
export const CHART_TOOLTIP_WRAPPER = { zIndex: 50 };

export type ChartTooltipItem = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: {
    fill?: string;
    percent?: number;
    label?: string;
    [key: string]: unknown;
  };
};

/**
 * Custom tooltip shared by desk overview charts. Popover surface tokens keep
 * it readable in light (white card) and dark (near-black card) mode, with
 * amber figures matching the boards' legend pills.
 *
 * Originally the nurse overview tooltip; the same recipe is used by the
 * teacher, guidance and registry overviews.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<ChartTooltipItem>;
  /** Label override (e.g. formatting an ISO date for the day axis). */
  formatLabel?: (label: string | number) => React.ReactNode;
  /** Per-row value override (e.g. the waiting-time chart's "2d 3h" label). */
  formatValue?: (item: ChartTooltipItem) => React.ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter(
    (item) => item.value !== undefined && item.value !== null,
  );
  if (items.length === 0) return null;

  return (
    <div className={styles.chartTooltip} role="tooltip">
      {label !== undefined && label !== null && label !== "" ? (
        <p className={styles.chartTooltipLabel}>
          {formatLabel ? formatLabel(label) : label}
        </p>
      ) : null}
      <ul className={styles.chartTooltipList}>
        {items.map((item, index) => {
          const rawFill = item.payload?.fill;
          // Area series carry a gradient paint server ("url(#…)") in `payload.fill`
          // which CSS `background` can't resolve — fall back to the stroke colour.
          const fill =
            (typeof rawFill === "string" && !rawFill.startsWith("url(")
              ? rawFill
              : undefined) ??
            item.color ??
            "var(--muted-foreground)";
          return (
            <li
              key={`${String(item.dataKey ?? item.name)}-${index}`}
              className={styles.chartTooltipRow}
            >
              <span
                className={styles.chartTooltipDot}
                style={{ background: fill }}
                aria-hidden="true"
              />
              <span className={styles.chartTooltipName}>{item.name}</span>
              <span className={styles.chartTooltipValue}>
                {formatValue ? formatValue(item) : item.value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
