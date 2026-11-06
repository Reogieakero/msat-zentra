"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import styles from "./guidance-overview.module.css";

// Amber ramp — amber-500 (the rail's accent) through 89% transparent, same
// shade steps as the nurse overview breakdown charts.
export const AMBER = "oklch(0.769 0.188 70.08)";
export const SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 12%)`,
  `color-mix(in oklch, ${AMBER}, transparent 26%)`,
  `color-mix(in oklch, ${AMBER}, transparent 40%)`,
  `color-mix(in oklch, ${AMBER}, transparent 54%)`,
  `color-mix(in oklch, ${AMBER}, transparent 66%)`,
  `color-mix(in oklch, ${AMBER}, transparent 76%)`,
];

export interface ChartRow {
  key: string;
  label: string;
  count: number;
}

interface Slice extends ChartRow {
  percent: number;
  fill: string;
}

function buildSlices(
  rows: ChartRow[],
  sortDescending: boolean,
): { slices: Slice[]; total: number } {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const ordered = sortDescending
    ? [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    : rows;
  const slices = ordered.map((r, i) => ({
    ...r,
    percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    fill: SHADES[i] ?? SHADES[SHADES.length - 1],
  }));
  return { slices, total };
}

/** Board header icon — same slot as the grade board. */
function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

const TOOLTIP_Z_INDEX = { zIndex: 50 };

/**
 * Custom tooltip shared by every chart on the page. Uses the popover surface
 * tokens so it reads correctly in both themes (white card in light mode, dark
 * card in dark mode) and shows the amber figures the boards use.
 */
function GuidanceChartTooltip({
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
    <div className={styles.chartTooltip} role="tooltip">
      {label !== undefined && label !== null && label !== "" ? (
        <p className={styles.chartTooltipLabel}>{label}</p>
      ) : null}
      <ul className={styles.chartTooltipList}>
        {items.map((item, index) => {
          const fill =
            (item.payload as { fill?: string } | undefined)?.fill ??
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
              <span className={styles.chartTooltipValue}>{item.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Board header count — amber figures, readable in both themes. */
function amberCount(value: number) {
  return <span className={styles.amberNumber}>{value}</span>;
}

/** Uniform "What it means" footer — bottom-left of every chart board. */
function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.interpretation}>
      <span className={styles.interpretationLabel}>What it means · </span>
      {children}
    </p>
  );
}

/** Donut kanban board — one chart per board, chromeless legend rows with the
    rectangle count/percent pill, same shell as the nurse breakdown donuts. */
export function GuidanceDonutPanel({
  title,
  description,
  rows,
  unit,
  emptyTitle,
  emptyText,
  icon: Icon,
  sortDescending = true,
  interpretation,
}: {
  title: string;
  description: string;
  rows: ChartRow[];
  unit: string;
  emptyTitle: string;
  emptyText: string;
  icon: LucideIcon;
  sortDescending?: boolean;
  interpretation: string;
}) {
  const { slices, total } = buildSlices(rows, sortDescending);
  const isEmpty = total === 0;

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={Icon} />}
      count={amberCount(total)}
      description={description}
      className="flex-1"
    >
      {isEmpty ? (
        <GuidanceEmptyState icon={Icon} title={emptyTitle} hint={emptyText} />
      ) : (
        <div className={styles.chartBody}>
          <div
            className={styles.chartRow}
            role="img"
            aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(", ")}`}
          >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={132}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="transparent"
                  isAnimationActive
                  animationDuration={700}
                >
                  {slices.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={<GuidanceChartTooltip />}
                  wrapperStyle={TOOLTIP_Z_INDEX}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.center} aria-hidden="true">
              <span className={styles.centerValue}>{total}</span>
              <span className={styles.centerLabel}>{unit}</span>
            </div>
          </div>

          <ul className={styles.legend}>
            {slices.map((s) => (
              <li key={s.key} className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: s.fill }} aria-hidden="true" />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendValue}>
                  <Pill label="Case count and share of this board">
                    <span className={styles.legendPillCount}>{s.count}</span>
                    <span className={styles.legendPillPercent}>{s.percent}%</span>
                  </Pill>
                </span>
              </li>
            ))}
          </ul>
          </div>
        </div>
      )}
      <Interpretation>{interpretation}</Interpretation>
    </KanbanBoard>
  );
}

/** Horizontal bar kanban board — amber bars per row, count label at the end.
    Same shell and spacing as the nurse breakdown bar boards. */
export function GuidanceBarPanel({
  title,
  description,
  rows,
  seriesName,
  emptyTitle,
  emptyText,
  icon: Icon,
  sortDescending = true,
  interpretation,
}: {
  title: string;
  description: string;
  rows: ChartRow[];
  seriesName: string;
  emptyTitle: string;
  emptyText: string;
  icon: LucideIcon;
  sortDescending?: boolean;
  interpretation: string;
}) {
  const { slices, total } = buildSlices(rows, sortDescending);
  const height = Math.max(120, slices.length * 28 + 8);
  const isEmpty = total === 0;

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={Icon} />}
      count={amberCount(total)}
      description={description}
      className="flex-1"
    >
      {isEmpty ? (
        <GuidanceEmptyState icon={Icon} title={emptyTitle} hint={emptyText} />
      ) : (
        <div
          className={`${styles.barChart} ${styles.chartBody}`}
          role="img"
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count}`).join(", ")}`}
        >
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={slices} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={false}
                content={<GuidanceChartTooltip />}
                wrapperStyle={TOOLTIP_Z_INDEX}
              />
              <Bar dataKey="count" name={seriesName} barSize={12} radius={[2, 4, 4, 2]}>
                {slices.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  className={styles.barNumber}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <Interpretation>{interpretation}</Interpretation>
    </KanbanBoard>
  );
}

export interface SectionLineRow {
  key: string;
  label: string;
  high: number;
  moderate: number;
}

/** Line chart board — high (solid amber) and moderate (dashed amber) risk per
    section, used by "Sections needing attention". */
export function GuidanceSectionsLinePanel({
  title,
  description,
  rows,
  emptyTitle,
  emptyText,
  icon: Icon,
  interpretation,
}: {
  title: string;
  description: string;
  rows: SectionLineRow[];
  emptyTitle: string;
  emptyText: string;
  icon: LucideIcon;
  interpretation: string;
}) {
  const ordered = [...rows].sort(
    (a, b) =>
      b.high + b.moderate - (a.high + a.moderate) || a.label.localeCompare(b.label),
  );
  const total = ordered.reduce((n, r) => n + r.high + r.moderate, 0);
  const highTotal = ordered.reduce((n, r) => n + r.high, 0);
  const moderateTotal = ordered.reduce((n, r) => n + r.moderate, 0);
  const highPercent = total > 0 ? Math.round((highTotal / total) * 100) : 0;
  const moderatePercent = total > 0 ? Math.round((moderateTotal / total) * 100) : 0;
  const isEmpty = ordered.length === 0 || total === 0;
  const highColor = SHADES[0];
  const moderateColor = `color-mix(in oklch, ${AMBER}, transparent 45%)`;

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={Icon} />}
      count={amberCount(total)}
      description={description}
      className="flex-1"
    >
      {isEmpty ? (
        <GuidanceEmptyState icon={Icon} title={emptyTitle} hint={emptyText} />
      ) : (
        <div className={styles.chartBody}>
          <div
            className={styles.lineChart}
            role="img"
            aria-label={`${title}: ${ordered
              .map((r) => `${r.label} ${r.high} high, ${r.moderate} moderate`)
              .join(", ")}`}
          >
            <ResponsiveContainer width="100%" height={210}>
              <LineChart
                data={ordered}
                margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={52}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  fontSize={11}
                  width={34}
                />
                <Tooltip
                  content={<GuidanceChartTooltip />}
                  wrapperStyle={TOOLTIP_Z_INDEX}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  name="High"
                  stroke={highColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: highColor, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="moderate"
                  name="Moderate"
                  stroke={moderateColor}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: moderateColor, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className={styles.legend}>
            <li className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: highColor }} aria-hidden="true" />
              <span className={styles.legendLabel}>High</span>
              <span className={styles.legendValue}>
                <Pill label="High-risk students and their share of flagged students">
                  <span className={styles.legendPillCount}>{highTotal}</span>
                  <span className={styles.legendPillPercent}>{highPercent}%</span>
                </Pill>
              </span>
            </li>
            <li className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: moderateColor }} aria-hidden="true" />
              <span className={styles.legendLabel}>Moderate</span>
              <span className={styles.legendValue}>
                <Pill label="Moderate-risk students and their share of flagged students">
                  <span className={styles.legendPillCount}>{moderateTotal}</span>
                  <span className={styles.legendPillPercent}>{moderatePercent}%</span>
                </Pill>
              </span>
            </li>
          </ul>
        </div>
      )}
      <Interpretation>{interpretation}</Interpretation>
    </KanbanBoard>
  );
}
