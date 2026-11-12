"use client";

import type { LucideIcon } from "lucide-react";
import styles from "./insights.module.css";

// Same amber ramp as the guidance overview / nurse breakdown boards.
export const AMBER = "oklch(0.769 0.188 70.08)";
export const SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 26%)`,
  `color-mix(in oklch, ${AMBER}, transparent 54%)`,
  `color-mix(in oklch, ${AMBER}, transparent 76%)`,
];

export const TOOLTIP_Z_INDEX = { zIndex: 50 };

export function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

/** Shared tooltip for every insights chart. */
export function InsightsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
    payload?: { fill?: string };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter(
    (item) => item.value !== undefined && item.value !== null,
  );
  if (items.length === 0) return null;

  return (
    <div className={styles.tooltip} role="tooltip">
      {label !== undefined && label !== null && label !== "" ? (
        <p className={styles.tooltipLabel}>{label}</p>
      ) : null}
      <ul className={styles.tooltipList}>
        {items.map((item, index) => {
          const fill =
            (item.payload as { fill?: string } | undefined)?.fill ??
            item.color ??
            "var(--muted-foreground)";
          return (
            <li
              key={`${String(item.dataKey ?? item.name)}-${index}`}
              className={styles.tooltipRow}
            >
              <span
                className={styles.tooltipDot}
                style={{ background: fill }}
                aria-hidden="true"
              />
              <span className={styles.tooltipName}>{item.name}</span>
              <span className={styles.tooltipValue}>{item.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface LegendEntry {
  label: string;
  color: string;
}

export function ChartLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul className={styles.legend}>
      {entries.map((entry) => (
        <li key={entry.label} className={styles.legendItem}>
          <span
            className={styles.swatch}
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          <span className={styles.legendLabel}>{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
