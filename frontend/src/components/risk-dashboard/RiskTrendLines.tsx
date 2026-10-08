"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryTrend } from "./risk-dashboard-data";
import { usePrimaryScale } from "./use-primary-scale";
import styles from "./RiskTrendLines.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

export function RiskTrendLines({
  trend,
  interpretation,
  primary,
}: {
  trend: CategoryTrend;
  interpretation: string;
  primary?: string | null;
}) {
  const shades = usePrimaryScale(Math.max(trend.series.length, 1), primary);
  const points = React.useMemo(
    () =>
      trend.weeks.map((w, i) => {
        const point: Record<string, string | number> = { week: w.label };
        for (const s of trend.series) point[s.key] = s.counts[i] ?? 0;
        return point;
      }),
    [trend],
  );
  return (
    <Card className={`${styles.panel} ${styles.glow}`} aria-label="Referrals over time by category">
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <CardTitle className={styles.title}>Referrals over time</CardTitle>
        <CardDescription className={styles.desc}>
          Cases per week by category — last 12 weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trend.total === 0 ? (
          <p className={styles.empty}>No referrals in the last 12 weeks.</p>
        ) : (
          <>
            <div
              className={styles.chart}
              role="img"
              aria-label={`Referrals over time: ${trend.series.map((s) => `${s.label} ${s.counts.reduce((a, n) => a + n, 0)}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(label) => `Week of ${label}`}
                  />
                  {trend.series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={shades[i % shades.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.legend} aria-label="Categories">
              {trend.series.map((s, i) => (
                <li key={s.key} className={styles.legendItem}>
                  <span
                    className={styles.dot}
                    style={{ backgroundColor: shades[i % shades.length] }}
                    aria-hidden
                  />
                  {s.label}
                  <span className={styles.legendCount}>
                    {s.counts.reduce((a, n) => a + n, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className={styles.interpretation}>
          <span className={styles.interpretationLabel}>What it means · </span>
          {interpretation}
        </p>
      </CardContent>
    </Card>
  );
}
