import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RISK_LEVEL_COLORS } from "../mockData";
import type { RiskBoardData } from "../riskBoard";
import styles from "./risk-trend-chart.module.css";

const LOOP_MS = 3000;

const FALLBACK: RiskBoardData["trend"] = [
  { term: "", high: 0, moderate: 0, low: 0 },
];

export function RiskTrendChart({
  data,
  loading,
}: {
  data: RiskBoardData["trend"] | null;
  loading: boolean;
}) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), LOOP_MS);
    return () => clearInterval(id);
  }, []);

  const chartData = (data ?? FALLBACK).map((p) => ({
    term: p.term,
    high: loading ? 0 : p.high,
    moderate: loading ? 0 : p.moderate,
    low: loading ? 0 : p.low,
  }));

  const last = chartData[chartData.length - 1];

  if (loading) {
    return (
      <Card size="sm" className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle>Risk Trend</CardTitle>
          <span className={styles.subtitle}>by term</span>
        </CardHeader>
        <CardContent className={styles.content}>
          <Skeleton className={styles.skelChart} />
          <div className={styles.skelFoot}>
            <Skeleton className={styles.skelFootValue} />
            <Skeleton className={styles.skelFootLabel} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>Risk Trend</CardTitle>
        <span className={styles.subtitle}>by term</span>
      </CardHeader>
      <CardContent className={styles.content}>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart
            key={tick}
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="term"
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis hide domain={[0, "dataMax + 10"]} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
            />
            <Line
              type="monotone"
              dataKey="high"
              name="High"
              stroke={RISK_LEVEL_COLORS.High}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="moderate"
              name="Moderate"
              stroke={RISK_LEVEL_COLORS.Moderate}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className={styles.footnote}>
          <span className={styles.footValue}>
            {loading ? "—" : last.high}
          </span>
          <span className={styles.footLabel}>high this term</span>
        </div>
      </CardContent>
    </Card>
  );
}
