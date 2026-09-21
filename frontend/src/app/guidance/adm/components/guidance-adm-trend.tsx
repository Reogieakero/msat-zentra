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
import type { GuidanceAdmSummary } from "./guidance-adm-data";
import styles from "./guidance-adm-reports.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

/**
 * Weekly line graph of ADM cases referred to guidance over the last
 * 12 weeks. Counts come from the full guidance caseload (never any page
 * filter).
 */
export function GuidanceAdmTrend({ summary }: { summary: GuidanceAdmSummary }) {
  const weeks = summary.referralTrend ?? [];
  const total = weeks.reduce((m, w) => m + w.count, 0);
  const peak = weeks.reduce(
    (best, w) => (w.count > best.count ? w : best),
    { week: "", label: "—", count: 0 }
  );

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>ADM referred over time</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Cases referred to guidance per week — last 12 weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className={styles.empty}>No ADM referrals in the last 12 weeks.</p>
        ) : (
          <>
            <div className={styles.trendWrap}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
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
                    formatter={(value) => [`${value} case${value === 1 ? "" : "s"}`, "Referred"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Referred"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--primary)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={styles.interpretation} role="status">
              {total} case{total === 1 ? "" : "s"} referred in 12 weeks
              {peak.count > 0 ? ` — busiest week of ${peak.label} with ${peak.count}.` : "."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
