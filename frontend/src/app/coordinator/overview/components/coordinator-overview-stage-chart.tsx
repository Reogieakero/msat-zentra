"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { usePrimaryScale } from "@/components/risk-dashboard/use-primary-scale";
import type { StageDonutEntry } from "./coordinator-overview-helpers";
import styles from "./coordinator-overview-stage-chart.module.css";

function buildInterpretation(slices: StageDonutEntry[], total: number): string {
  if (total === 0) {
    return "No cases are in the pipeline yet — new referrals will appear here by stage.";
  }
  const top = [...slices].sort((a, b) => b.value - a.value)[0];
  return `${total} case${total === 1 ? "" : "s"} in the pipeline, most sitting at ${top.full} (${top.value}).`;
}

export function CoordinatorOverviewStageChart({
  stageDonut,
  primary,
}: {
  stageDonut: StageDonutEntry[];
  /** Saved settings hex — wins over the probed runtime palette. */
  primary?: string | null;
}) {
  // Slices wear the coordinator's own workspace palette (darkest first),
  // tracking recolors live via the runtime --primary probe when no saved
  // hex is set yet.
  const scale = usePrimaryScale(Math.max(stageDonut.length, 1), primary);
  const slices = stageDonut.map((d, i) => ({
    ...d,
    fill: scale[i % scale.length] ?? d.fill,
  }));
  const total = slices.reduce((n, d) => n + d.value, 0);
  const chartConfig = Object.fromEntries(
    slices.map((s) => [s.name, { label: s.full, color: s.fill }]),
  ) as ChartConfig;

  return (
    <Card className={styles.card}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <CardTitle className={styles.sectionTitle}>Cases by stage</CardTitle>
        <CardDescription className={styles.sectionDesc}>
          Live pipeline distribution.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.body}>
        <div className={styles.donutWrap}>
          <ChartContainer config={chartConfig} className={styles.donut}>
            <PieChart>
              <ChartTooltip
                wrapperStyle={{ zIndex: 50 }}
                content={
                  <ChartTooltipContent
                    className={styles.tooltipSolid}
                    formatter={(value, name) => `${name}: ${value} case(s)`}
                  />
                }
              />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={2}
                strokeWidth={0}
              >
                {slices.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className={styles.donutCenter} aria-hidden="true">
            <span className={styles.donutTotal}>{total}</span>
            <span className={styles.donutLabel}>cases</span>
          </div>
        </div>
        <p className={styles.interpretation}>
          <span className={styles.interpretationLabel}>What it means · </span>
          {buildInterpretation(slices, total)}
        </p>
      </CardContent>
    </Card>
  );
}
