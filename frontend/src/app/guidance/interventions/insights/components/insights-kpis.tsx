"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { InterventionInsightKpis } from "@/services/guidance/insights.types";
import styles from "../../../pages.module.css";

export function InsightsKpis({ kpis }: { kpis: InterventionInsightKpis }) {
  const closed = kpis.resolved + kpis.unresolved;
  const cards = [
    {
      label: "Follow-ups this term",
      value: kpis.total,
      hint: `${kpis.ongoing} ongoing · ${kpis.resolved} resolved · ${kpis.unresolved} unresolved`,
    },
    {
      label: "Intervention success rate",
      value: `${kpis.successRate}%`,
      hint: closed > 0 ? `${kpis.resolved} of ${closed} closed follow-ups resolved` : "No closed follow-ups yet",
    },
    {
      label: "Avg. time to resolution",
      value: kpis.avgResolutionDays === null ? "—" : `${kpis.avgResolutionDays} d`,
      hint: "From triage to the last completed session",
    },
    {
      label: "Session completion",
      value: `${kpis.sessionCompletionRate}%`,
      hint: `${kpis.sessionsCompleted} of ${kpis.sessionsTotal} counseling sessions completed`,
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((kpi) => (
        <Card key={kpi.label} size="sm" className={styles.card}>
          <CardContent>
            <p className={styles.kpiLabel}>{kpi.label}</p>
            <p className={styles.kpiValue}>{kpi.value}</p>
            <p className={styles.kpiHint}>{kpi.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
