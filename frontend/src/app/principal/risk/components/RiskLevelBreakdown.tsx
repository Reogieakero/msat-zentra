"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { useGradeMode } from "../../grade-mode-context";
import type { RiskBoardData, RiskFactor, RiskLevelKey } from "@/services/principal/risk.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./RiskLevelBreakdown.module.css";

const LEVELS: RiskLevelKey[] = ["High", "Moderate", "Low"];

// Primary-tinted level ramp, identical in light and dark mode (same as
// the overview risk charts and the donut beside this card).
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
    <div className={`${assign.card} ${styles.card}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <h3 className={`${styles.title} relative`}>Risk Breakdown</h3>

      {isPending ? (
        <p className={`${styles.summary} relative`}>Loading risk distribution…</p>
      ) : total === 0 ? (
        <p className={`${styles.summary} relative`}>
          No students are currently flagged for risk. The board is all clear for
          the active term.
        </p>
      ) : (
        <>
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
        </>
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
              {isPending ? "—" : `${counts[level]} (${pct(counts[level])}%)`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
