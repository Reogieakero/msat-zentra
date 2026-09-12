"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidanceAnecdotalSummary } from "./guidance-anecdotal-data";
import styles from "./guidance-anecdotal-charts.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "var(--chart-1)",
  bullying: "var(--chart-2)",
  academic: "var(--chart-3)",
  attendance: "var(--chart-4)",
  health: "var(--chart-5)",
};

interface GuidanceAnecdotalChartsProps {
  summary: GuidanceAnecdotalSummary;
}

function interpretSummary(summary: GuidanceAnecdotalSummary): string {
  if (summary.total === 0) {
    return "No cases referred to you yet — referred filings will break down here by category.";
  }
  const rows = [
    { category: "behavioral", count: summary.behavioral },
    { category: "bullying", count: summary.bullying },
    { category: "academic", count: summary.academic },
    { category: "attendance", count: summary.attendance },
    { category: "health", count: summary.health },
  ];
  const top = [...rows].sort((a, b) => b.count - a.count)[0];
  return `${summary.total} referred records — most filed as ${top.category} (${top.count}). Unreferred filings are never counted here.`;
}

export function GuidanceAnecdotalCharts({ summary }: GuidanceAnecdotalChartsProps) {
  const rows = [
    { category: "behavioral", count: summary.behavioral },
    { category: "bullying", count: summary.bullying },
    { category: "academic", count: summary.academic },
    { category: "attendance", count: summary.attendance },
    { category: "health", count: summary.health },
  ];

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Referred records by category</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Only cases advisers referred to you — live counts.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.body}>
        {summary.total === 0 ? (
          <p className={styles.empty}>No cases referred to you yet.</p>
        ) : (
          <div className={styles.split}>
            <div className={styles.donutWrap}>
              <ResponsiveContainer width="100%" height={168}>
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {rows.map((r) => (
                      <Cell key={r.category} fill={CATEGORY_COLORS[r.category] ?? "#737373"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <span className={styles.donutValue}>{summary.total}</span>
                <span className={styles.donutCaption}>records</span>
              </div>
            </div>
            <ul className={styles.legend}>
              {rows.map((r) => (
                <li key={r.category} className={styles.legendItem}>
                  <span className={styles.legendLabel}>
                    <span
                      className={styles.legendDot}
                      style={{ backgroundColor: CATEGORY_COLORS[r.category] ?? "#737373" }}
                      aria-hidden
                    />
                    {r.category}
                  </span>
                  <span className={styles.legendCount}>{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className={styles.interpretation}>{interpretSummary(summary)}</p>
      </CardContent>
    </Card>
  );
}
