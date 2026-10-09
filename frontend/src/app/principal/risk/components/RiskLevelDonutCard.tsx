"use client";

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { RiskBoardData, RiskLevelKey } from "@/services/principal/risk.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./RiskLevelDonutCard.module.css";

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

  if (isPending) {
    return (
      <div className={assign.card} aria-busy="true" aria-label="Loading risk levels">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div aria-hidden="true" className="flex flex-col items-center gap-3">
          <Skeleton className="h-4 w-40 self-start" />
          <Skeleton className="size-36 rounded-full" />
          <div className="flex flex-col gap-1.5 self-stretch">
            <Skeleton className="h-4 w-32" />
          </div>
          <ul className={styles.legend}>
            {FALLBACK.map((d) => (
              <li key={d.level} className={styles.legendItem}>
                <Skeleton className="size-2.5 shrink-0" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-10 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <PrincipalEmptyState
          icon={ShieldCheck}
          title="No risk data this term"
          hint="No students flagged for risk in the active term. Risk levels will appear here once detected."
        />
      </div>
    );
  }
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
            {total.toLocaleString()}
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
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
