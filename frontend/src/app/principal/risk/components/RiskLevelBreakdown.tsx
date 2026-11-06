"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { RiskBoardData, RiskFactor, RiskLevelKey } from "@/services/principal/risk.types";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./RiskLevelBreakdown.module.css";

const LEVELS: RiskLevelKey[] = ["High", "Moderate", "Low"];

// Amber scale, shared with the risk distribution / history charts.
const LEVEL_FILL: Record<RiskLevelKey, string> = {
  High: "#b45309",
  Moderate: "#f59e0b",
  Low: "#fcd34d",
};

const LEVEL_TONE: Record<RiskLevelKey, "amber" | "neutral"> = {
  High: "amber",
  Moderate: "amber",
  Low: "neutral",
};

const FACTOR_LABEL: Record<RiskFactor, string> = {
  Academic: "academic grades",
  Attendance: "attendance",
  Behavioral: "behavioral conduct",
};

export function RiskLevelBreakdown() {
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

  const counts: Record<RiskLevelKey, number> = {
    High: 0,
    Moderate: 0,
    Low: 0,
  };
  for (const d of data?.levelDistribution ?? []) counts[d.level] = d.count;

  const total = counts.High + counts.Moderate + counts.Low;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  const atRisk = counts.High + counts.Moderate;

  const factorTotals = data?.factorTotals ?? {
    Academic: 0,
    Attendance: 0,
    Behavioral: 0,
  };
  const dominantFactor = (Object.entries(factorTotals).sort(
    (a, b) => b[1] - a[1]
  )[0] ?? ["Academic", 0]) as [RiskFactor, number];

  return (
    <KanbanBoard
      title="Risk Breakdown"
      icon={<Info size={14} aria-hidden="true" />}
      count={isPending ? undefined : total}
      description="What the numbers mean for this term."
      actions={
        <Pill tone="green" label="Data source">
          Adviser-shared
        </Pill>
      }
      className="flex-1"
    >
      {isPending ? (
        <div className={styles.loading} aria-busy="true">
          <Skeleton className="h-4 w-full" aria-hidden="true" />
          <Skeleton className="h-4 w-full" aria-hidden="true" />
          <Skeleton className="h-4 w-2/3" aria-hidden="true" />
          <ul className={styles.list} aria-hidden="true">
            {LEVELS.map((level) => (
              <li key={level} className={styles.item}>
                <Skeleton className="size-2.5 shrink-0" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-16 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      ) : total === 0 ? (
        <PrincipalEmptyState
          icon={ShieldCheck}
          title="Board is all clear"
          hint="No students are currently flagged for risk in the active term."
        />
      ) : (
        <>
          <p className={styles.summary}>
            <strong>{atRisk.toLocaleString()}</strong> of{" "}
            <strong>{total.toLocaleString()}</strong> students ({atRisk === 0 ? 0 : pct(atRisk)}
            %) are at some level of risk. Of those,{" "}
            <strong>{counts.High.toLocaleString()}</strong> are high risk and need
            priority review.
          </p>

          <ul className={styles.list}>
            {LEVELS.map((level) => (
              <li key={level} className={styles.item}>
                <span
                  className={styles.swatch}
                  style={{ background: LEVEL_FILL[level] }}
                />
                <div className={styles.itemText}>
                  <Pill tone={LEVEL_TONE[level]} label="Risk level">
                    {level}
                  </Pill>
                  <span className={styles.itemDetail}>
                    {level === "High"
                      ? "Needs immediate intervention"
                      : level === "Moderate"
                        ? "Monitor closely"
                        : "On track / no action needed"}
                  </span>
                </div>
                <span className={styles.itemValue}>
                  {`${counts[level]} (${pct(counts[level])}%)`}
                </span>
              </li>
            ))}
          </ul>

          {dominantFactor[1] > 0 && (
            <InsightCallout className="mt-auto">
              The most common trigger is{" "}
              <strong>{FACTOR_LABEL[dominantFactor[0]]}</strong> — it accounts for{" "}
              <strong>{dominantFactor[1].toLocaleString()}</strong> at-risk flag
              {dominantFactor[1] === 1 ? "" : "s"}. Targeting this area could reduce
              overall risk the fastest.
            </InsightCallout>
          )}
        </>
      )}
    </KanbanBoard>
  );
}
