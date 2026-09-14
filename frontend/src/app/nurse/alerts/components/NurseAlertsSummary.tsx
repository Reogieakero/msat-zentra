"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { NurseAlertsSummary } from "./nurse-alerts-data";
import styles from "./nurse-alerts.module.css";

export function NurseAlertsSummary({ summary }: { summary: NurseAlertsSummary }) {
  const cards = [
    {
      label: "Urgent",
      value: summary.urgent,
      hint: "escalated + overdue follow-ups",
    },
    {
      label: "New",
      value: summary.fresh,
      hint: "waiting for first review",
    },
    {
      label: "Follow-ups",
      value: summary.followUps,
      hint: "marked for follow-through",
    },
    {
      label: "Resolved this week",
      value: summary.resolvedWeek,
      hint: `of ${summary.total} alerts`,
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
