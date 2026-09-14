"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import type { NurseBreakdownRow } from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

/** Neutral ink scale — darkest slice always marks the leading segment. */
const SHADES = ["#171717", "#525252", "#737373", "#a3a3a3", "#d4d4d4", "#e5e5e5", "#f5f5f5"];

interface Slice extends NurseBreakdownRow {
  percent: number;
  fill: string;
}

function buildSlices(rows: NurseBreakdownRow[]): { slices: Slice[]; total: number } {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const ranked = [...rows].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const slices = ranked.map((r, i) => ({
    ...r,
    percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
    fill: SHADES[i] ?? SHADES[SHADES.length - 1],
  }));
  return { slices, total };
}

function DonutPanel({
  title,
  description,
  rows,
  emptyText,
  unit,
}: {
  title: string;
  description: string;
  rows: NurseBreakdownRow[];
  emptyText: string;
  unit: string;
}) {
  const { slices, total } = buildSlices(rows);

  return (
    <Card className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <p className={styles.panelDesc}>{description}</p>
      {rows.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div
          className={styles.chartRow}
          role="img"
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count}`).join(", ")}`}
        >
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={700}
                >
                  {slices.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Pie>
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
                  {s.count} · {s.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function NurseOverviewBreakdown({
  statusBreakdown,
  categoryBreakdown,
}: {
  statusBreakdown: NurseBreakdownRow[];
  categoryBreakdown: NurseBreakdownRow[];
}) {
  return (
    <div className={styles.twoCol}>
      <DonutPanel
        title="Caseload by status"
        description="Every case ever routed to the clinic."
        rows={statusBreakdown}
        emptyText="No cases yet."
        unit={statusBreakdown.reduce((n, r) => n + r.count, 0) === 1 ? "case" : "cases"}
      />
      <DonutPanel
        title="Caseload by category"
        description="What the underlying reports were about."
        rows={categoryBreakdown}
        emptyText="No cases yet."
        unit={categoryBreakdown.reduce((n, r) => n + r.count, 0) === 1 ? "case" : "cases"}
      />
    </div>
  );
}
