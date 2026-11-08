"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessagesSquare } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { GuidanceEmptyState } from "../../../components/GuidanceEmptyCard";
import type { InterventionInsightSessionTypeRow } from "@/services/guidance/insights.types";
import {
  AMBER,
  BoardIcon,
  ChartLegend,
  InsightsTooltip,
  SHADES,
  TOOLTIP_Z_INDEX,
} from "./insights-chart-shared";
import styles from "./insights.module.css";

const CANCELLED = "color-mix(in oklch, var(--muted-foreground), transparent 62%)";

export function InsightsSessionBoard({
  rows,
}: {
  rows: InterventionInsightSessionTypeRow[];
}) {
  const total = rows.reduce((n, r) => n + r.total, 0);
  const visible = rows.filter((r) => r.total > 0);

  return (
    <KanbanBoard
      title="Sessions by type"
      icon={<BoardIcon icon={MessagesSquare} />}
      count={<span className={styles.heatRate}>{total}</span>}
      description="How the term's counseling sessions were delivered and whether they pushed through."
      className={`flex-1 ${styles.boardIn}`}
    >
      {visible.length === 0 ? (
        <GuidanceEmptyState
          icon={MessagesSquare}
          title="No sessions booked yet"
          hint="Sessions scheduled, completed, or cancelled on intervention cases will be counted here."
        />
      ) : (
        <div className={styles.chartBody}>
          <ResponsiveContainer width="100%" height={Math.max(150, visible.length * 42 + 10)}>
            <BarChart
              data={visible}
              layout="vertical"
              margin={{ top: 2, right: 8, bottom: 2, left: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={112}
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
                dataKey="completed"
                name="Completed"
                stackId="session"
                fill={AMBER}
                barSize={16}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="scheduled"
                name="Scheduled"
                stackId="session"
                fill={SHADES[1]}
                barSize={16}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="cancelled"
                name="Cancelled"
                stackId="session"
                fill={CANCELLED}
                barSize={16}
                radius={[0, 3, 3, 0]}
                isAnimationActive
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>

          <ChartLegend
            entries={[
              { label: "Completed", color: AMBER },
              { label: "Scheduled", color: SHADES[1] },
              { label: "Cancelled", color: CANCELLED },
            ]}
          />
        </div>
      )}
      <div className="mt-auto">
        <InsightCallout>
          <span className="font-semibold">What it means · </span>
          Home visits and parent conferences carry the heaviest follow-through
          risk; cancelled or still-scheduled sessions are the first place to look
          when a case stalls.
        </InsightCallout>
      </div>
    </KanbanBoard>
  );
}
