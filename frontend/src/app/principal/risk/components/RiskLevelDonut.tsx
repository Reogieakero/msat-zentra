import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RISK_LEVEL_COLORS } from "../riskData";
import type { RiskLevelKey } from "../riskBoard";
import styles from "./risk-level-donut.module.css";

const LOOP_MS = 3000;

const FALLBACK: { level: RiskLevelKey; count: number }[] = [
  { level: "High", count: 0 },
  { level: "Moderate", count: 0 },
  { level: "Low", count: 0 },
];

export function RiskLevelDonut({
  data,
  loading,
}: {
  data: { level: RiskLevelKey; count: number }[] | null;
  loading: boolean;
}) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), LOOP_MS);
    return () => clearInterval(id);
  }, []);

  const series = (data ?? FALLBACK).map((d) => ({
    level: d.level,
    count: loading ? 0 : d.count,
  }));
  const total = series.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return (
      <Card size="sm" className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle>Risk Level</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <div className={styles.chartWrap}>
            <Skeleton className={styles.skelChart} />
            <div className={styles.center}>
              <Skeleton className={styles.skelCenterValue} />
              <Skeleton className={styles.skelCenterLabel} />
            </div>
          </div>
          <ul className={styles.legend}>
            {FALLBACK.map((d) => (
              <li key={d.level} className={styles.legendItem}>
                <Skeleton className={styles.skelSwatch} />
                <Skeleton className={styles.skelLegendLabel} />
                <Skeleton className={styles.skelLegendValue} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>Risk Level</CardTitle>
      </CardHeader>
      <CardContent className={styles.content}>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={96}>
            <PieChart key={tick}>
              <Pie
                data={series}
                dataKey="count"
                nameKey="level"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={1}
                stroke="none"
                isAnimationActive
                animationDuration={900}
              >
                {series.map((d) => (
                  <Cell key={d.level} fill={RISK_LEVEL_COLORS[d.level]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.center}>
            <span className={styles.centerValue}>
              {loading ? "—" : total.toLocaleString()}
            </span>
            <span className={styles.centerLabel}>students</span>
          </div>
        </div>
        <ul className={styles.legend}>
          {series.map((d) => (
            <li key={d.level} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: RISK_LEVEL_COLORS[d.level] }}
              />
              <span className={styles.legendLabel}>{d.level}</span>
              <span className={styles.legendValue}>{loading ? "—" : d.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
