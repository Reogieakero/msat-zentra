"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GuidanceKpis } from "./guidance-overview-data";
import styles from "./guidance-overview-kpis.module.css";

interface GuidanceOverviewKpisProps {
  kpis: GuidanceKpis;
}

export function GuidanceOverviewKpis({ kpis }: GuidanceOverviewKpisProps) {
  const cards = [
    {
      label: "Referred to me",
      value: kpis.referredToMe,
      hint: "pending + in progress",
    },
    {
      label: "Open interventions",
      value: kpis.openInterventions,
      hint: `${kpis.myInterventions} assigned to me`,
    },
    {
      label: "High-risk students",
      value: kpis.highRisk,
      hint: "live recompute, active term",
    },
    {
      label: "Pending ADM hand-offs",
      value: kpis.admHandoffs,
      hint: `${kpis.admHomeVisitation} at home visitation`,
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
