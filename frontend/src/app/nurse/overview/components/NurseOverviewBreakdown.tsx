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
import type { NurseBreakdownRow } from "@/services/nurse/nurse.types";
import type { LucideIcon } from "lucide-react";
import { Activity, ClipboardList, Send } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import styles from "./nurse-overview.module.css";

// Amber ramp — the rail's accent (tailwind amber-500), so the donut slices
// and bars share the page's action color. Same shade steps as before.
const AMBER = "oklch(0.769 0.188 70.08)"; // amber-500
const SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 25%)`,
  `color-mix(in oklch, ${AMBER}, transparent 45%)`,
  `color-mix(in oklch, ${AMBER}, transparent 60%)`,
  `color-mix(in oklch, ${AMBER}, transparent 72%)`,
  `color-mix(in oklch, ${AMBER}, transparent 82%)`,
  `color-mix(in oklch, ${AMBER}, transparent 89%)`,
];

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

/** Board header icon — same slot as the main "Latest referred students" board. */
function BoardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="text-primary" aria-hidden>
      <Icon size={14} />
    </span>
  );
}

/** One chart per kanban board: header (icon, title, total) + description +
    the chart itself, chromeless rows — same shell as the case board above. */
function BarPanel({
  title,
  description,
  rows,
  emptyTitle,
  emptyText,
  icon: Icon,
}: {
  title: string;
  description: string;
  rows: NurseBreakdownRow[];
  emptyTitle: string;
  emptyText: string;
  icon: LucideIcon;
}) {
  const { slices, total } = buildSlices(rows);
  const height = Math.max(120, slices.length * 28 + 8);
  const isEmpty = rows.length === 0;

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={Icon} />}
      count={total}
      description={description}
      className="flex-1"
    >
      {isEmpty ? (
        <NurseEmptyState icon={Icon} title={emptyTitle} hint={emptyText} />
      ) : (
        <div
          className={`${styles.barChart} relative`}
          role="img"
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(", ")}`}
        >
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={slices} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} />
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
              <Bar dataKey="count" barSize={12} radius={[2, 4, 4, 2]}>
                {slices.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
                <LabelList dataKey="count" position="right" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </KanbanBoard>
  );
}

function DonutPanel({
  title,
  description,
  rows,
  emptyTitle,
  emptyText,
  unit,
  icon: Icon,
}: {
  title: string;
  description: string;
  rows: NurseBreakdownRow[];
  emptyTitle: string;
  emptyText: string;
  unit: string;
  icon: LucideIcon;
}) {
  const { slices, total } = buildSlices(rows);
  const isEmpty = rows.length === 0;

  return (
    <KanbanBoard
      title={title}
      icon={<BoardIcon icon={Icon} />}
      count={total}
      description={description}
      className="flex-1"
    >
      {isEmpty ? (
        <NurseEmptyState icon={Icon} title={emptyTitle} hint={emptyText} />
      ) : (
        <div
          className={`${styles.chartRow} relative`}
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
                  <span className={styles.legendPill}>
                    <span className={styles.legendPillCount}>{s.count}</span>
                    <span className={styles.legendPillPercent} style={{ color: AMBER }}>
                      {s.percent}%
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </KanbanBoard>
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
        description="Every referred case — ADM and clinic matters — by the same actions as the case lists."
        rows={statusBreakdown}
        emptyTitle="No cases yet"
        emptyText="Cases referred to the clinic will appear here."
        icon={Activity}
        unit={statusBreakdown.reduce((n, r) => n + r.count, 0) === 1 ? "case" : "cases"}
      />
      <BarPanel
        title="Clinic matters caseload"
        description="Referred clinic matters, by clinic action."
        rows={clinicStatusBreakdown}
        emptyTitle="No clinic cases yet"
        emptyText="Clinic matters referred to you will appear here."
        icon={ClipboardList}
      />
      <BarPanel
        title="ADM cases caseload"
        description="Referred ADM cases, by ADM action."
        rows={admStatusBreakdown}
        emptyTitle="No ADM cases yet"
        emptyText="ADM cases referred to you will appear here."
        icon={Send}
      />
    </div>
  );
}
