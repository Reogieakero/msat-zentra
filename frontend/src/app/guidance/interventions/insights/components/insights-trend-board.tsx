"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceEmptyState } from "../../../components/GuidanceEmptyCard";
import type { InterventionInsightTrendRow } from "@/services/guidance/insights.types";
import {
  AMBER,
  BoardIcon,
  ChartLegend,
  InsightsTooltip,
  SHADES,
  TOOLTIP_Z_INDEX,
} from "./insights-chart-shared";
import styles from "./insights.module.css";

export function InsightsTrendBoard({
  rows,
  termLabel,
}: {
  rows: InterventionInsightTrendRow[];
  termLabel: string;
}) {
  const totalOpened = rows.reduce((n, r) => n + r.opened, 0);
  const totalResolved = rows.reduce((n, r) => n + r.resolved, 0);
  const isEmpty = rows.length === 0 || (totalOpened === 0 && totalResolved === 0);

  return (
    <KanbanBoard
      title="Pipeline trend"
      icon={<BoardIcon icon={TrendingUp} />}
      count={<span className={styles.heatRate}>{totalOpened}</span>}
      description={`Monthly follow-ups opened vs. resolved and counseling sessions held — ${termLabel}.`}
      className={`flex-1 ${styles.boardIn}`}
    >
      {isEmpty ? (
        <GuidanceEmptyState
          icon={TrendingUp}
          title="No intervention activity yet"
          hint="Openings, resolutions, and sessions will trend here once follow-ups start this term."
        />
      ) : (
        <div className={styles.chartBody}>
          <div
            className={styles.trendChart}
            role="img"
            aria-label={`Pipeline trend: ${rows.map((r) => `${r.label} ${r.opened} opened, ${r.resolved} resolved, ${r.sessions} sessions`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklch, var(--primary), transparent 94%)" }}
                  content={<InsightsTooltip />}
                  wrapperStyle={TOOLTIP_Z_INDEX}
                />
                <Bar
                  dataKey="sessions"
                  name="Sessions"
                  fill={SHADES[3]}
                  radius={[3, 3, 0, 0]}
                  barSize={22}
                  isAnimationActive
                  animationDuration={700}
                />
                <Line
                  type="monotone"
                  dataKey="opened"
                  name="Opened"
                  stroke={AMBER}
                  strokeWidth={2}
                  dot={{ r: 3, fill: AMBER, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={700}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke={AMBER}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: AMBER, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={700}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            entries={[
              { label: "Sessions held", color: SHADES[3] },
              { label: "Opened", color: AMBER },
              { label: "Resolved (last completed session)", color: AMBER },
            ]}
          />
        </div>
      )}
      <div className="mt-auto">
        <InsightCallout>
          <span className="font-semibold">What it means · </span>
          Openings minus resolutions is the live caseload pressure; a resolution
          line that keeps up with openings means the desk is closing cases as
          fast as the risk engine flags them.
        </InsightCallout>
      </div>
    </KanbanBoard>
  );
}
