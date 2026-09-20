"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/providers";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CategorySlice } from "./nurse-risk-data";
import styles from "./NurseRiskCategories.module.css";

/**
 * Desk cases grouped by report category — one bar per category. Counts
 * only; the underlying write-ups stay on their case pages.
 */
export function NurseRiskCategories({
  rows,
  interpretation,
}: {
  rows: CategorySlice[];
  interpretation: string;
}) {
  // Tooltip swatch follows the theme ink so it stays legible on the
  // popover surface in both modes.
  const { resolvedTheme } = useTheme();
  const chartConfig = {
    count: { label: "Cases", color: resolvedTheme === "dark" ? "#fafafa" : "#171717" },
  } satisfies ChartConfig;
  return (
    <Card className={styles.panel}>
      <h2 className={styles.panelTitle}>Cases by category</h2>
      <p className={styles.panelDesc}>
        What the underlying reports on the clinic desk are about.
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>No categorized cases yet.</p>
      ) : (
        <div
          role="img"
          aria-label={`Cases by category: ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}`}
        >
          <ChartContainer config={chartConfig} className={styles.chart}>
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 0, left: -6 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={12}
                tick={{ fontSize: 12, fill: "currentColor" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fill: "currentColor" }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => `${value} case(s)`} />
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {rows.map((c) => (
                  <Cell key={c.key} fill={c.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
      <p className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {interpretation}
      </p>
    </Card>
  );
}
