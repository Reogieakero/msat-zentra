"use client";

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartPie, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { RiskBoardData, RiskLevelKey } from "@/services/principal/risk.types";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./RiskLevelDonutCard.module.css";

// Amber scale, shared with the risk distribution / history charts.
const LEVEL_FILL: Record<RiskLevelKey, string> = {
  High: "#b45309",
  Moderate: "#f59e0b",
  Low: "#fcd34d",
};

const FALLBACK: { level: RiskLevelKey; count: number }[] = [
  { level: "High", count: 0 },
  { level: "Moderate", count: 0 },
  { level: "Low", count: 0 },
];

export function RiskLevelDonutCard() {
  const { activeTerm } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["risk-board", activeTerm?.termId ?? null, activeTerm?.schoolYearId ?? null],
    queryFn: async () => {
      const res = await apiClient.get<RiskBoardData>("/api/risk/board");
      return res.data;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const series = (data?.levelDistribution ?? FALLBACK).map((d) => ({
    level: d.level,
    count: d.count,
  }));
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const high = series.find((d) => d.level === "High")?.count ?? 0;
  const highShare = total === 0 ? 0 : Math.round((high / total) * 100);

  return (
    <KanbanBoard
      title="Students by Risk Level"
      icon={<ChartPie size={14} aria-hidden="true" />}
      count={isPending ? undefined : total}
      description="Amber deepens as risk rises."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
      className="flex-1"
    >
      {isPending ? (
        <div className={styles.loading} aria-busy="true" aria-label="Loading risk levels">
          <Skeleton className="size-36 self-center rounded-full" aria-hidden="true" />
          <ul className={styles.legend} aria-hidden="true">
            {FALLBACK.map((d) => (
              <li key={d.level} className={styles.legendItem}>
                <Skeleton className="size-2.5 shrink-0" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-10 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      ) : total === 0 ? (
        <PrincipalEmptyState
          icon={ShieldCheck}
          title="No risk data this term"
          hint="No students flagged for risk in the active term. Risk levels will appear here once detected."
        />
      ) : (
        <>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={150}>
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
              <span className={styles.centerValue}>{total.toLocaleString()}</span>
              <span className={styles.centerLabel}>students</span>
            </div>
          </div>

          <ul className={styles.legend}>
            {series.map((d) => (
              <li key={d.level} className={styles.legendItem}>
                <span
                  className={styles.swatch}
                  style={{ background: LEVEL_FILL[d.level] }}
                />
                <Pill tone={d.level === "High" ? "amber" : "neutral"} label="Risk level">
                  {d.level}
                </Pill>
                <span className={styles.legendValue}>{d.count}</span>
              </li>
            ))}
          </ul>

          <p className={`${styles.insight} mt-auto`}>
            <strong>{highShare}%</strong> of flagged learners are high risk —{" "}
            {high.toLocaleString()} student{high === 1 ? "" : "s"} need priority review.
          </p>
        </>
      )}
    </KanbanBoard>
  );
}
