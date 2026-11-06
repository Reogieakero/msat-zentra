"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { RiskBoardData, RiskLevelKey } from "@/services/principal/risk.types";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import styles from "./RiskLevelDistribution.module.css";

// Amber scale for the whole chart family — deep amber for the levels that
// need attention, light amber for the calm end of the scale.
const RISK_AMBER: Record<RiskLevelKey, string> = {
  High: "#b45309",
  Moderate: "#f59e0b",
  Low: "#fcd34d",
};

const LEVELS: RiskLevelKey[] = ["High", "Moderate", "Low"];

const chartConfig = {
  High: { label: "High risk", color: RISK_AMBER.High },
  Moderate: { label: "Moderate", color: RISK_AMBER.Moderate },
  Low: { label: "Low risk", color: RISK_AMBER.Low },
} satisfies ChartConfig;

const gradeNum = (name: string) => {
  const m = String(name).match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? 0 : n;
};

export function RiskLevelDistribution() {
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

  // One group of three bars per section, placed strictly Grade 7 → Grade 12.
  // Only sections whose adviser has connected/shared student data are served.
  const bySections = React.useMemo(() => {
    return [...(data?.bySection ?? [])]
      .sort((a, b) => {
        const gradeDiff = gradeNum(a.gradeLevel) - gradeNum(b.gradeLevel);
        if (gradeDiff !== 0) return gradeDiff;
        return a.section.localeCompare(b.section, undefined, { numeric: true });
      })
      .map((s) => ({
        section: s.section,
        gradeLevel: s.gradeLevel,
        High: s.High,
        Moderate: s.Moderate,
        Low: s.Low,
        total: s.total,
      }));
  }, [data]);

  const totals = React.useMemo(() => {
    return bySections.reduce(
      (acc, g) => {
        acc.High += g.High;
        acc.Moderate += g.Moderate;
        acc.Low += g.Low;
        acc.total += g.total;
        return acc;
      },
      { High: 0, Moderate: 0, Low: 0, total: 0 }
    );
  }, [bySections]);

  const isEmpty = !isPending && bySections.length === 0;

  const peak = React.useMemo(() => {
    if (bySections.length === 0) return null;
    return [...bySections].sort(
      (a, b) => b.High + b.Moderate - (a.High + a.Moderate)
    )[0] ?? null;
  }, [bySections]);

  return (
    <KanbanBoard
      title="Risk Level Distribution"
      icon={<Users size={14} aria-hidden="true" />}
      count={isPending ? undefined : totals.total}
      description="Three bars per section — High, Moderate and Low, ordered G7 to G12. Only adviser-connected learners are shown."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
    >
      {isPending ? (
        <div className={styles.skeletonWrap} aria-hidden="true">
          <Skeleton className="h-[240px] w-full" />
        </div>
      ) : isEmpty ? (
        <PrincipalEmptyState
          icon={Users}
          title="No connected learner data"
          hint="No sections with adviser-shared learners were found for the active term."
        />
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className={styles.chart}
            style={{ height: 260, width: "100%", aspectRatio: "auto" }}
          >
            <BarChart
              accessibilityLayer
              data={bySections}
              barCategoryGap={18}
              barGap={2}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="section"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={8}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {LEVELS.map((level, index) => (
                <Bar
                  key={level}
                  dataKey={level}
                  name={chartConfig[level].label as string}
                  fill={`var(--color-${level})`}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                  isAnimationActive
                  animationBegin={index * 140}
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              ))}
              <ChartLegend
                verticalAlign="top"
                align="right"
                content={<ChartLegendContent />}
              />
            </BarChart>
          </ChartContainer>

          <p className={styles.insight}>
            {peak && peak.High + peak.Moderate > 0 ? (
              <>
                <strong>{peak.section}</strong> carries the most at-risk learners —{" "}
                <strong>{peak.High}</strong> high and <strong>{peak.Moderate}</strong>{" "}
                moderate. School-wide: <strong>{totals.High}</strong> high,{" "}
                <strong>{totals.Moderate}</strong> moderate,{" "}
                <strong>{totals.Low}</strong> low across{" "}
                <strong>{bySections.length}</strong> connected section
                {bySections.length === 1 ? "" : "s"}.
              </>
            ) : (
              <>
                No at-risk learners in connected sections this term —{" "}
                <strong>{totals.Low}</strong> learner
                {totals.Low === 1 ? "" : "s"} currently on track.
              </>
            )}
          </p>
        </>
      )}
    </KanbanBoard>
  );
}
