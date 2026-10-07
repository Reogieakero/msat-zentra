"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { useGradeMode } from "../../grade-mode-context";
import type { RiskBoardData, RiskLevelKey } from "../riskBoard";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./RiskLevelDonutCard.module.css";

// Primary-tinted donut ramp, identical in light and dark mode (same as
// the overview risk charts). Applied through style fills so the CSS vars
// resolve inside recharts SVG.
const LEVEL_FILL: Record<RiskLevelKey, string> = {
  High: "var(--primary)",
  Moderate: "color-mix(in oklch, var(--primary) 60%, var(--card))",
  Low: "color-mix(in oklch, var(--primary) 30%, var(--card))",
};

const FALLBACK: { level: RiskLevelKey; count: number }[] = [
  { level: "High", count: 0 },
  { level: "Moderate", count: 0 },
  { level: "Low", count: 0 },
];

export function RiskLevelDonutCard() {
  const { gradeMode } = useGradeMode();

  const { activeTerm } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["risk-board", activeTerm?.termId ?? null, gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<RiskBoardData>("/api/risk/board", {
        params: { gradeMode },
      });
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const series = (data?.levelDistribution ?? FALLBACK).map((d) => ({
    level: d.level,
    count: isPending ? 0 : d.count,
  }));
  const total = series.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={assign.card}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <h3 className={`${styles.title} relative`}>Students by Risk Level</h3>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={series}
              dataKey="count"
              nameKey="level"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
              isAnimationActive
              animationDuration={900}
            >
              {series.map((d) => (
                <Cell key={d.level} style={{ fill: LEVEL_FILL[d.level] }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.center}>
          <span className={styles.centerValue}>
            {isPending ? "—" : total.toLocaleString()}
          </span>
          <span className={styles.centerLabel}>students</span>
        </div>
      </div>

      <ul className={`${styles.legend} relative`}>
        {series.map((d) => (
          <li key={d.level} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ background: LEVEL_FILL[d.level] }}
            />
            <span className={styles.legendLabel}>{d.level}</span>
            <span className={styles.legendValue}>
              {isPending ? "—" : d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
