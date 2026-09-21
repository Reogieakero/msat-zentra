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
      hint: `needs action · ADM ${kpis.pendingAdm} + Counseling ${kpis.pendingCounseling}`,
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
      hint: "endorsed · with the coordinator",
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
