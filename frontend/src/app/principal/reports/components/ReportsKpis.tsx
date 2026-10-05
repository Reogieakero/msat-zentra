import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { ReportKpis as KpiData } from "../reports-data";
import styles from "./reports-kpis.module.css";

function bandFor(avg: number): string {
  if (avg >= 90) return "Advancing band";
  if (avg >= 80) return "Benchmarking band";
  if (avg >= 75) return "Connecting band";
  if (avg >= 65) return "Developing band";
  return "Emerging band";
}

export function ReportsKpis({
  loading,
  data,
}: {
  loading: boolean;
  data: KpiData | null;
}) {
  if (loading || !data) {
    return (
      <div className={styles.skelStrip}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={styles.skelCard} />
        ))}
      </div>
    );
  }

  const kpis = data;
  const totalInterventions =
    kpis.interventionRate > 0
      ? Math.round((kpis.interventionsResolved * 100) / kpis.interventionRate)
      : 0;

  const defs = [
    {
      key: "avgTransmuted",
      label: "Avg Transmuted Grade",
      value: `${kpis.avgTransmuted}`,
      message: `${bandFor(kpis.avgTransmuted)} school-wide this term.`,
    },
    {
      key: "interventionsResolved",
      label: "Interventions Resolved",
      value: `${kpis.interventionsResolved}`,
      message: `${kpis.interventionRate}% success rate across cases.`,
    },
    {
      key: "interventionRate",
      label: "Success Rate",
      value: `${kpis.interventionRate}%`,
      message: `${kpis.interventionsResolved} of ${totalInterventions} referred resolved.`,
    },
    {
      key: "sectionsAtRisk",
      label: "Sections At-Risk",
      value: `${kpis.sectionsAtRisk}`,
      message: `${kpis.honorRoll} on honor roll vs ${kpis.sectionsAtRisk} at risk.`,
    },
    {
      key: "honorRoll",
      label: "Honor Roll",
      value: `${kpis.honorRoll}`,
      message: "Academic Excellence awardees, listed alphabetically.",
    },
  ] as const;

  return (
    <div className={styles.kpiStrip}>
      {defs.map((def) => (
        <div key={def.key} className={styles.kpiCard}>
          <span className={styles.glowClip} aria-hidden="true">
            <span className={styles.cardGlow} />
          </span>
          <span className={styles.kpiLabel}>{def.label}</span>
          <span className={styles.kpiValue}>{def.value}</span>
          <p className={styles.kpiMessage}>
            <span className={styles.kpiMessageLabel}>What it means · </span>
            {def.message}
          </p>
        </div>
      ))}
    </div>
  );
}
