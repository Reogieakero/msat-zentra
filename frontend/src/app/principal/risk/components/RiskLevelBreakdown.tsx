"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { RiskBoardData, RiskFactor, RiskLevelKey } from "@/services/principal/risk.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./RiskLevelBreakdown.module.css";

const LEVELS: RiskLevelKey[] = ["High", "Moderate", "Low"];

const LEVEL_FILL: Record<RiskLevelKey, string> = {
  High: "var(--primary)",
  Moderate: "color-mix(in oklch, var(--primary) 60%, var(--card))",
  Low: "color-mix(in oklch, var(--primary) 30%, var(--card))",
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

  if (!isPending && total === 0) {
    return (
      <div className={`${assign.card} ${styles.card}`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <PrincipalEmptyState
          icon={ShieldCheck}
          title="Board is all clear"
          hint="No students are currently flagged for risk in the active term."
        />
      </div>
    );
  }
  return (
    <div className={`${assign.card} ${styles.card}`} aria-busy={isPending || undefined}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      {isPending ? (
        <>
          <Skeleton className="h-5 w-36" aria-hidden="true" />
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <ul className={styles.list} aria-hidden="true">
            {LEVELS.map((level) => (
              <li key={level} className={styles.item}>
                <Skeleton className="size-2.5 shrink-0" />
                <div className={styles.itemText}>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="ml-auto h-4 w-20 shrink-0" />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
      <h3 className={`${styles.title} relative`}>Risk Breakdown</h3>

      <p className={`${styles.summary} relative`}>
        <strong style={{ color: "var(--primary)" }}>
          {atRisk.toLocaleString()}
        </strong>{" "}
        of <strong>{total.toLocaleString()}</strong> students ({" "}
        <strong>{pct(atRisk)}%</strong> ) are at some level of risk. Of those,{" "}
        <strong style={{ color: "var(--primary)" }}>
          {counts.High.toLocaleString()}
        </strong>{" "}
        are high risk and need priority review.
      </p>

      {dominantFactor[1] > 0 && (
        <p className={`${styles.insight} relative`}>
          The most common trigger is{" "}
          <strong>{FACTOR_LABEL[dominantFactor[0]]}</strong> — it accounts for{" "}
          <strong>{dominantFactor[1].toLocaleString()}</strong> at-risk flag
          {dominantFactor[1] === 1 ? "" : "s"}. Targeting this area could
          reduce overall risk the fastest.
        </p>
      )}

      <ul className={`${styles.list} relative`}>
        {LEVELS.map((level) => (
          <li key={level} className={styles.item}>
            <span
              className={styles.swatch}
              style={{ background: LEVEL_FILL[level] }}
            />
            <div className={styles.itemText}>
              <span className={styles.itemLabel}>{level} risk</span>
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
        </>
      )}
    </div>
  );
}
