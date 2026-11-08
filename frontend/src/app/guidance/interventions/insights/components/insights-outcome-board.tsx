"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { GuidanceEmptyState } from "../../../components/GuidanceEmptyCard";
import type { InterventionInsightOutcomeRow } from "@/services/guidance/insights.types";
import {
  AMBER,
  BoardIcon,
  ChartLegend,
  InsightsTooltip,
  SHADES,
  TOOLTIP_Z_INDEX,
} from "./insights-chart-shared";
import styles from "./insights.module.css";

const UNRESOLVED = "color-mix(in oklch, var(--muted-foreground), transparent 62%)";

/** Amber ramp for the grade donut slices — darkest slice = highest volume. */
const DONUT_SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 18%)`,
  `color-mix(in oklch, ${AMBER}, transparent 36%)`,
  `color-mix(in oklch, ${AMBER}, transparent 52%)`,
  `color-mix(in oklch, ${AMBER}, transparent 66%)`,
  `color-mix(in oklch, ${AMBER}, transparent 78%)`,
];

/**
 * Success rate that never lies about a non-zero ratio: a tiny but real share
 * (e.g. 1 of 241) reads "<1%" instead of rounding down to a misleading "0%".
 */
function formatRate(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const value = (part / whole) * 100;
  if (value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

export function InsightsOutcomeBoard({
  title,
  description,
  rows,
  icon,
  emptyTitle,
  emptyText,
  interpretation,
  variant = "bars",
}: {
  title: string;
  description: string;
  rows: InterventionInsightOutcomeRow[];
  icon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
  interpretation: React.ReactNode;
  /** "bars" = stacked horizontal bars + breakdown list; "donut" = grade donut. */
  variant?: "bars" | "donut";
}) {
  const total = rows.reduce((n, r) => n + r.total, 0);
  const ordered = [...rows]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || b.rate - a.rate);

  const totalResolved = ordered.reduce((n, r) => n + r.resolved, 0);
  const overallRate = formatRate(totalResolved, total);
  const donutData = ordered.map((row, index) => ({
    ...row,
    fill: DONUT_SHADES[index % DONUT_SHADES.length],
  }));

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={icon} />}
      count={<span className={styles.heatRate}>{total}</span>}
      description={description}
      className={`flex-1 ${styles.boardIn}`}
    >
      {ordered.length === 0 ? (
        <GuidanceEmptyState icon={icon} title={emptyTitle} hint={emptyText} />
      ) : variant === "donut" ? (
        <div
          className={styles.donutWrap}
          role="img"
          aria-label={`Success by grade: ${donutData
            .map(
              (r) =>
                `${r.label} ${r.resolved} of ${r.total} resolved (${formatRate(
                  r.resolved,
                  r.total,
                )})`,
            )
            .join(", ")}`}
        >
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="total"
                nameKey="label"
                innerRadius={58}
                outerRadius={84}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
              >
                {donutData.map((row) => (
                  <Cell key={row.key} fill={row.fill} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                wrapperStyle={TOOLTIP_Z_INDEX}
                content={({ active, payload }) => {
                  const row = active
                    ? (payload?.[0]?.payload as (typeof donutData)[number] | undefined)
                    : undefined;
                  if (!row) return null;
                  return (
                    <div className={styles.tooltip} role="tooltip">
                      <p className={styles.tooltipLabel}>{row.label}</p>
                      <ul className={styles.tooltipList}>
                        <li className={styles.tooltipRow}>
                          <span
                            className={styles.tooltipDot}
                            style={{ background: row.fill }}
                            aria-hidden="true"
                          />
                          <span className={styles.tooltipName}>
                            {row.resolved}/{row.total} resolved
                          </span>
                          <span className={styles.tooltipValue}>
                            {formatRate(row.resolved, row.total)}
                          </span>
                        </li>
                      </ul>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.donutCenter} aria-hidden="true">
            <span className={styles.donutValue}>{overallRate}</span>
            <span className={styles.donutLabel}>resolved</span>
          </div>
        </div>
      ) : (
        <div className={styles.chartBody}>
          <ResponsiveContainer width="100%" height={Math.max(150, ordered.length * 38 + 10)}>
            <BarChart
              data={ordered}
              layout="vertical"
              margin={{ top: 2, right: 8, bottom: 2, left: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={92}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklch, var(--primary), transparent 94%)" }}
                content={<InsightsTooltip />}
                wrapperStyle={TOOLTIP_Z_INDEX}
              />
              <Bar
                dataKey="resolved"
                name="Resolved"
                stackId="outcome"
                fill={AMBER}
                barSize={16}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="ongoing"
                name="Ongoing"
                stackId="outcome"
                fill={SHADES[1]}
                barSize={16}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="unresolved"
                name="Unresolved"
                stackId="outcome"
                fill={UNRESOLVED}
                barSize={16}
                radius={[0, 3, 3, 0]}
                isAnimationActive
                animationDuration={700}
              >
                {ordered.map((row) => (
                  <Cell key={row.key} fill={UNRESOLVED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <ChartLegend
            entries={[
              { label: "Resolved", color: AMBER },
              { label: "Ongoing", color: SHADES[1] },
              { label: "Unresolved", color: UNRESOLVED },
            ]}
          />

          <ul className="mt-2 flex flex-col divide-y divide-border">
            {ordered.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate font-medium text-foreground">
                  {row.label}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">
                    {row.resolved}/{row.total} resolved
                  </span>
                  <Pill label={`${row.label} success rate`}>
                    <span className={styles.heatRate}>
                      {formatRate(row.resolved, row.total)}
                    </span>
                  </Pill>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto">
        <InsightCallout>
          <span className="font-semibold">What it means · </span>
          {interpretation}
        </InsightCallout>
      </div>
    </KanbanBoard>
  );
}
