"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
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
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { RiskTrendData } from "@/services/principal/risk.types";
import styles from "./RiskTrend.module.css";

const LEVEL_FILL = {
  high: "var(--primary)",
  moderate: "color-mix(in oklch, var(--primary) 60%, var(--card))",
  low: "color-mix(in oklch, var(--primary) 30%, var(--card))",
} as const;

const chartConfig = {
  high: { label: "High risk", color: LEVEL_FILL.high },
  moderate: { label: "Moderate", color: LEVEL_FILL.moderate },
  low: { label: "Low risk", color: LEVEL_FILL.low },
} satisfies ChartConfig;

const SERIES = [
  { key: "high", color: LEVEL_FILL.high },
  { key: "moderate", color: LEVEL_FILL.moderate },
  { key: "low", color: LEVEL_FILL.low },
] as const;

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["value"];

export function RiskTrend() {
  const gradId = React.useId().replace(/:/g, "");

  // The trend always follows the workspace term — no local SY/term filter.
  const { activeTerm } = useTerm();

  const [range, setRange] = usePersistentState<RangeKey>(
    "zentra.risk.trend.range",
    "all"
  );

  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const termId = activeTerm?.termId ?? null;

  const { data, isPending } = useQuery({

    queryKey: ["risk-trend", schoolYearId, termId ?? "none"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (schoolYearId) params.schoolYearId = schoolYearId;
      if (termId) params.termId = termId;
      const res = await apiClient.get<RiskTrendData>("/api/risk/trend", { params });
      return res.data;
    },
    enabled: schoolYearId !== null && termId !== null,
  });

  const isDaily = termId !== null;

  const trend = data?.trend ?? [];
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

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>Risk Trend</h2>
          <p className={styles.subtitle}>
            {isDaily
              ? "Total for the selected term"
              : "School-wide risk trend by term"}
          </p>
        </div>
        <div className={styles.filters}>
          <p className={styles.scopeNote} aria-live="polite">
            {activeTerm
              ? `Showing ${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
              : "No workspace term selected"}
          </p>
        </div>
      </div>

      <div className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        {!isPending && !hasData ? (
        <div className="relative">
            <PrincipalEmptyState
              icon={TrendingUp}
              title="No trend data yet"
              hint="No risk trend data available for the selected school year and term."
            />
        </div>
        ) : (
        <>
        <div className={`${styles.cardHeader} relative`}>
          <p className={styles.cardDesc}>
            {isDaily
              ? "Daily risk levels for the selected term"
              : "Risk levels aggregated per term"}
          </p>
          <div className={styles.cardActions}>
            {isDaily && (
              <div className={styles.rangeGroup}>
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`${styles.rangeBtn} ${
                      range === r.value ? styles.rangeActive : ""
                    }`}
                    onClick={() => setRange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          {isPending ? (
            <div className={styles.skeleton} />
          ) : (
            <div className={styles.chartBox}>
              <ChartContainer
                config={chartConfig}
                className={styles.chartContainer}
              >
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 8, left: 4 }}
                >
                  <defs>
                      {SERIES.map((s) => (
                      <linearGradient
                        key={s.key}
                        id={`${gradId}-${s.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          style={{ stopColor: s.color }}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          style={{ stopColor: s.color }}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
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
                    <Area
                      key={s.key}
                      dataKey={s.key}
                      name={s.key}
                      type="monotone"
                      strokeWidth={2}
                      style={{ stroke: s.color }}
                      fill={`url(#${gradId}-${s.key})`}
                      dot={false}
                    />
                  ))}
                  <ChartLegend
                    verticalAlign="top"
                    align="right"
                    content={<ChartLegendContent />}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </section>
  );
}
