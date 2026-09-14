"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { NurseKpis } from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

export function NurseOverviewKpis({ kpis }: { kpis: NurseKpis }) {
  const cards = [
    {
      label: "Needs review",
      value: kpis.needsReview,
      hint: "pending cases on your desk",
    },
    {
      label: "In progress",
      value: kpis.inProgress,
      hint: "being handled or followed up",
    },
    {
      label: "Escalated to me",
      value: kpis.escalatedToMe,
      hint: "sent up to the clinic",
    },
    {
      label: "Resolved",
      value: kpis.resolved,
      hint: "closed cases",
    },
    {
      label: "Health-related",
      value: kpis.healthRelated,
      hint: `of ${kpis.total} total cases`,
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
