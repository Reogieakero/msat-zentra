import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { ReportKpis as KpiData } from "../reports-data";
import styles from "./reports-kpis.module.css";

const KPI_DEFS = [
  { key: "avgTransmuted", label: "Avg Transmuted Grade", suffix: "", delta: "" },
  { key: "interventionsResolved", label: "Interventions Resolved", suffix: "", delta: "" },
  { key: "interventionRate", label: "Success Rate", suffix: "%", delta: "" },
  { key: "sectionsAtRisk", label: "Sections At-Risk", suffix: "", delta: "" },
  { key: "honorRoll", label: "Honor Roll", suffix: "", delta: "" },
] as const;

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

  return (
    <div className={styles.kpiStrip}>
      {KPI_DEFS.map((def) => (
        <div key={def.key} className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{def.label}</span>
          <span className={styles.kpiValue}>
            {kpis[def.key]}
            {def.suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
