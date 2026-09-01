"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { apiClient } from "@/lib/api/client";
import { useGradeMode } from "../../grade-mode-context";
import { RISK_LEVEL_COLORS } from "../riskData";
import type { RiskBoardData, RiskLevelKey } from "../riskBoard";
import styles from "./RiskLevelDonutCard.module.css";

const FALLBACK: { level: RiskLevelKey; count: number }[] = [
  { level: "High", count: 0 },
  { level: "Moderate", count: 0 },
  { level: "Low", count: 0 },
];

export function RiskLevelDonutCard() {
  const { gradeMode } = useGradeMode();

  const { data, isPending } = useQuery({
    queryKey: ["risk-board", gradeMode],
    queryFn: async () => {
      const res = await apiClient.get<RiskBoardData>("/api/risk/board", {
        params: { gradeMode },
      });
      return res.data;
    },
  });

  const series = (data?.levelDistribution ?? FALLBACK).map((d) => ({
    level: d.level,
    count: isPending ? 0 : d.count,
  }));
  const total = series.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Students by Risk Level</h3>

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
                <Cell key={d.level} fill={RISK_LEVEL_COLORS[d.level]} />
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

      <ul className={styles.legend}>
        {series.map((d) => (
          <li key={d.level} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ background: RISK_LEVEL_COLORS[d.level] }}
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
