"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

/* Horizontal bars for the per-type cards — same neutral scale and legend
   as the donut, but counts are directly comparable across the two cards. */
function BarPanel({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: NurseBreakdownRow[];
  emptyText: string;
}) {
  const { slices, total } = buildSlices(rows);
  const height = Math.max(168, slices.length * 36 + 16);

  return (
    <Card className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <p className={styles.panelDesc}>{description}</p>
      {rows.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <>
          <div
            className={styles.barChart}
            role="img"
            aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={slices} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontSize: "0.75rem",
                  }}
                  formatter={(value) => [value, "Cases"]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" barSize={18} radius={[2, 6, 6, 2]}>
                  {slices.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                  <LabelList dataKey="count" position="right" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className={styles.legendTotal}>
            {total} {total === 1 ? "case" : "cases"} total
          </p>
        </>
      )}
    </Card>
  );
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
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(", ")}`}
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
  clinicStatusBreakdown,
  admStatusBreakdown,
}: {
  statusBreakdown: NurseBreakdownRow[];
  clinicStatusBreakdown: NurseBreakdownRow[];
  admStatusBreakdown: NurseBreakdownRow[];
}) {
  return (
    <div className={styles.threeCol}>
      <DonutPanel
        title="Caseload by status"
        description="Every case routed to the clinic, by action status."
        rows={statusBreakdown}
        emptyText="No cases yet."
        unit={statusBreakdown.reduce((n, r) => n + r.count, 0) === 1 ? "case" : "cases"}
      />
      <BarPanel
        title="Clinic matters caseload"
        description="Clinic cases, by action status."
        rows={clinicStatusBreakdown}
        emptyText="No clinic cases yet."
      />
      <BarPanel
        title="ADM cases caseload"
        description="ADM cases, by action status."
        rows={admStatusBreakdown}
        emptyText="No ADM cases yet."
      />
    </div>
  );
}
