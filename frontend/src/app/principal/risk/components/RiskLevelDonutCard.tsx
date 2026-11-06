"use client";

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartPie, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { useCountUp } from "@/lib/hooks/useCountUp";
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

interface DonutTipPayload {
  name?: string;
  value?: number;
  payload?: { level?: RiskLevelKey; count?: number };
}

/**
 * Hover read-out for one arc — level, head count and share of the flagged
 * total. Kept in the app's Inter stack (no recharts default font).
 */
function DonutTip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: DonutTipPayload[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0];
  const level = (datum.payload?.level ?? datum.name ?? "") as RiskLevelKey;
  const count = Number(datum.value ?? datum.payload?.count ?? 0);
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 font-sans text-xs shadow-xl">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: LEVEL_FILL[level] }}
        />
        {level} risk
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Students</span>
        <span className="font-sans font-medium tabular-nums text-foreground">
          {count.toLocaleString()} ({share}%)
        </span>
      </div>
    </div>
  );
}

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
  // The centre figure ticks up in step with the arc drawing in.
  const totalShown = useCountUp(total, 1100);

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
                  paddingAngle={2}
                  cornerRadius={3}
                  stroke="none"
                  isAnimationActive
                  animationBegin={140}
                  animationDuration={1100}
                  animationEasing="ease-out"
                >
                  {series.map((d) => (
                    <Cell key={d.level} style={{ fill: LEVEL_FILL[d.level] }} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  content={<DonutTip total={total} />}
                  wrapperStyle={{ outline: "none", zIndex: 50 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.center}>
              <span className={styles.centerValue}>{totalShown.toLocaleString()}</span>
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
