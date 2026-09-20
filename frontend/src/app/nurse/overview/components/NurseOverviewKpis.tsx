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
      label: "Booked session",
      value: kpis.bookedSession,
      hint: "cases with an active booking",
    },
    {
      label: "Endorsed to ADM coordinator",
      value: kpis.endorsedToAdm,
      hint: "sent to the coordinator",
    },
    {
      label: "Follow-up",
      value: kpis.followUp,
      hint: "awaiting follow-up",
    },
    {
      label: "Done session",
      value: kpis.doneSession,
      hint: "cases with a completed session",
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
