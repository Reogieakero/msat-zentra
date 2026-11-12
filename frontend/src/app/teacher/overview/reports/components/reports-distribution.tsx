"use client";

import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import type { TeacherReportsPayload } from "@/services/teacher/reports.types";
import { formatPercent } from "./reports-format";
import styles from "./reports.module.css";

/* Amber ramp — same steps as the teacher overview charts. */
const AMBER = "oklch(0.769 0.188 70.08)";
const SHADES = [
  AMBER,
  `color-mix(in oklch, ${AMBER}, transparent 14%)`,
  `color-mix(in oklch, ${AMBER}, transparent 28%)`,
  `color-mix(in oklch, ${AMBER}, transparent 42%)`,
  `color-mix(in oklch, ${AMBER}, transparent 56%)`,
];

interface Band {
  band: string;
  label: string;
  count: number;
  percent: number;
  fill: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload?: Band }[];
}

function BandTooltip({ active, payload }: TooltipPayload) {
  const band = payload?.[0]?.payload;
  if (!active || !band) return null;
  return (
    <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 font-sans text-xs shadow-xl">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: band.fill }}
        />
        {band.label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Range</span>
        <span className="font-sans font-medium tabular-nums text-foreground">{band.band}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Final grades</span>
        <span className="font-sans font-medium tabular-nums text-foreground">
          {band.count} ({formatPercent(band.percent, 1)})
        </span>
      </div>
    </div>
  );
}

export function ReportsDistribution({
  distribution,
}: {
  distribution: TeacherReportsPayload["distribution"];
}) {
  const total = distribution.reduce((sum, band) => sum + band.count, 0);
  const below = distribution.find((band) => band.band === "below-75")?.count ?? 0;
  const passing = total - below;

  const bands: Band[] = distribution.map((band, i) => ({
    ...band,
    fill: SHADES[i] ?? SHADES[SHADES.length - 1],
  }));

  return (
    <KanbanBoard
      title="Grade distribution"
      icon={
        <span className={styles.boardIcon} aria-hidden>
          <BarChart3 size={14} />
        </span>
      }
      count={<span className={styles.amberNumber}>{total}</span>}
      description="DepEd bands across every final grade you recorded this term."
      className="flex-1"
    >
      {total === 0 ? null : (
        <div
          className={styles.barChart}
          role="img"
          aria-label={`Grade distribution: ${bands
            .map((band) => `${band.label} ${band.count}`)
            .join(", ")}`}
        >
          <ResponsiveContainer width="100%" height={208}>
            <BarChart data={bands} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="band" tickLine={false} axisLine={false} interval={0} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={<BandTooltip />}
                wrapperStyle={{ outline: "none", zIndex: 80 }}
              />
              <Bar dataKey="count" name="Final grades" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {bands.map((band) => (
                  <Cell key={band.band} fill={band.fill} />
                ))}
                <LabelList dataKey="count" position="top" className={styles.barNumber} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className={styles.footerSlot}>
        <InsightCallout className={styles.interpretation}>
          <span className={styles.interpretationLabel}>What it means · </span>
          {total === 0
            ? "No finalized grades yet — the bands fill as classes lock finals."
            : `${passing} of ${total} final grade${total === 1 ? "" : "s"} pass${
                passing === 1 ? "es" : ""
              }; ${below} ${below === 1 ? "is" : "are"} below the 75 line.`}
        </InsightCallout>
      </div>
    </KanbanBoard>
  );
}
