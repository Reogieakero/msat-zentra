"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GuidanceAlertsSummary } from "./guidance-alerts-data";
import styles from "./guidance-alerts-summary.module.css";

interface GuidanceAlertsSummaryProps {
  summary: GuidanceAlertsSummary;
}

export function GuidanceAlertsSummary({ summary }: GuidanceAlertsSummaryProps) {
  const cards = [
    {
      label: "High-risk flags",
      value: summary.high,
      hint: "2+ factors tripped",
    },
    {
      label: "Moderate flags",
      value: summary.moderate,
      hint: "1 factor tripped",
    },
    {
      label: "Referred to me",
      value: summary.referred,
      hint: "flagged + has referral",
    },
    {
      label: "Needs referral",
      value: summary.unreferred,
      hint: "flagged, no referral yet",
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
