"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GuidanceReferralsSummary } from "./guidance-referrals-data";
import styles from "./guidance-referrals-summary.module.css";

interface GuidanceReferralsSummaryProps {
  summary: GuidanceReferralsSummary;
}

export function GuidanceReferralsSummary({ summary }: GuidanceReferralsSummaryProps) {
  const cards = [
    {
      label: "Total referred",
      value: summary.total,
      hint: "all cases routed to you",
    },
    {
      label: "Pending",
      value: summary.pending,
      hint: "waiting to be accepted",
    },
    {
      label: "In progress",
      value: summary.inProgress,
      hint: "actively being worked",
    },
    {
      label: "Resolved",
      value: summary.resolved,
      hint: "follow-through done",
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
