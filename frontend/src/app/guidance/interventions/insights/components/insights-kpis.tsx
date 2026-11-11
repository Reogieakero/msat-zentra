"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { outcomeTone } from "@/lib/labels/status-tone";
import type { InterventionInsightKpis } from "@/services/guidance/insights.types";
import styles from "../../../pages.module.css";

const OUTCOMES = [
  { key: "ongoing", tooltip: "Ongoing follow-ups" },
  { key: "resolved", tooltip: "Resolved follow-ups" },
  { key: "unresolved", tooltip: "Unresolved follow-ups" },
] as const;

export function InsightsKpis({ kpis }: { kpis: InterventionInsightKpis }) {
  const closed = kpis.resolved + kpis.unresolved;
  // Plan mix reads as three status chips (same tones as the board) instead of
  // one dot-separated sentence; each chip names its bucket on hover.
  const outcomeDetail = (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {OUTCOMES.map((outcome) => (
        <Pill
          key={outcome.key}
          tone={outcomeTone(outcome.key)}
          label={outcome.tooltip}
        >
          {kpis[outcome.key]}{" "}
          {outcome.key.charAt(0).toUpperCase() + outcome.key.slice(1)}
        </Pill>
      ))}
    </div>
  );
  const cards: {
    label: string;
    value: number | string;
    hint?: string;
    detail?: React.ReactNode;
  }[] = [
    {
      label: "Follow-ups this term",
      value: kpis.total,
      detail: outcomeDetail,
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
            {kpi.detail ?? <p className={styles.kpiHint}>{kpi.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
