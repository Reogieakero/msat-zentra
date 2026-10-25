"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useTerm } from "@/lib/term/TermContext";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import type { RiskTrendData } from "@/services/principal/risk.types";
import styles from "./RiskTrend.module.css";

const AMBER = {
  high: "#b45309",
  moderate: "#f59e0b",
  low: "#fcd34d",
} as const;

const chartConfig = {
  high: { label: "High risk", color: AMBER.high },
  moderate: { label: "Moderate", color: AMBER.moderate },
  low: { label: "Low risk", color: AMBER.low },
} satisfies ChartConfig;

const SERIES = [
  { key: "low", label: "Low risk", color: AMBER.low },
  { key: "moderate", label: "Moderate", color: AMBER.moderate },
  { key: "high", label: "High risk", color: AMBER.high },
] as const;

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["value"];

export function RiskTrend() {
  // Server-scoped: the trend follows the active school year/term. Daily vs
  // per-term rows are inferred from the response, not from client state.
  const { activeSchoolYear } = useTerm();

  const [range, setRange] = usePersistentState<RangeKey>(
    "zentra.risk.trend.range",
    "all"
  );

  const { data, isPending } = useQuery({
    queryKey: ["risk-trend"],
    queryFn: async () => {
      const res = await apiClient.get<RiskTrendData>("/api/risk/trend");
      return res.data;
    },
  });

  const trend = data?.trend ?? [];
  const isDaily = trend.some((t) => Boolean(t.date));
  let chartData = trend.map((t) => ({
    date: t.date,
    term: t.term,
    high: isPending ? 0 : t.high,
    moderate: isPending ? 0 : t.moderate,
    low: isPending ? 0 : t.low,
  }));

  if (isDaily && range !== "all") {
    const n = Number(range);
    const dates = chartData.map((d) => d.date).filter(Boolean);
    if (dates.length > 0) {
      const max = dates.reduce((a, b) => (a > b ? a : b));
      const maxDate = new Date(`${max}T00:00:00`);
      maxDate.setDate(maxDate.getDate() - (n - 1));
      const cutoff = maxDate.getTime();
      chartData = chartData.filter((d) => {
        if (!d.date) return false;
        return new Date(`${d.date}T00:00:00`).getTime() >= cutoff;
      });
    }
  }

  const hasData = chartData.length > 0;

  const latest = chartData[chartData.length - 1];
  const latestTotal = latest ? latest.high + latest.moderate + latest.low : 0;
  const latestHighShare =
    latest && latestTotal > 0 ? Math.round((latest.high / latestTotal) * 100) : 0;

  const rangeControl = isDaily ? (
    <div className={styles.rangeGroup} role="group" aria-label="Trend range">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          className={`${styles.rangeBtn} ${range === r.value ? styles.rangeActive : ""}`}
          aria-pressed={range === r.value}
          onClick={() => setRange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  ) : undefined;

  return (
    <KanbanBoard
      title="Risk History"
      icon={<TrendingUp size={14} aria-hidden="true" />}
      description={
        isDaily
          ? "Daily flagged learners shared by their advisers for the active term."
          : "Flagged learners shared by their advisers, aggregated per term."
      }
      actions={
        <>
          <Pill tone="green" label="Data source">
            Adviser-shared
          </Pill>
          {rangeControl}
        </>
      }
    >
      {!isPending && !hasData ? (
        <PrincipalEmptyState
          icon={TrendingUp}
          title="No shared trend data yet"
          hint="No risk history is available for adviser-shared learners in the active school year and term."
        />
      ) : isPending ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className={styles.chartContainer}
            style={{ height: 300, width: "100%", aspectRatio: "auto" }}
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="term"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={isDaily ? 24 : 0}
                interval={isDaily ? "preserveStartEnd" : 0}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="risk"
                  fill={`var(--color-${s.key})`}
                  radius={s.key === "high" ? [4, 4, 0, 0] : undefined}
                />
              ))}
              <ChartLegend
                verticalAlign="top"
                align="right"
                content={<ChartLegendContent />}
              />
            </BarChart>
          </ChartContainer>

          {latest ? (
            <p className={styles.insight}>
              Latest snapshot: <strong>{latestTotal}</strong> learners flagged,{" "}
              <strong>{latest.high}</strong> high risk (
              {latestHighShare}%).{" "}
              {activeSchoolYear ? `Scoped to ${activeSchoolYear.name}.` : ""}
            </p>
          ) : null}
        </>
      )}
    </KanbanBoard>
  );
}
