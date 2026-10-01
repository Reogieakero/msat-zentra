"use client";

import { Activity, CalendarClock, CheckCircle2, Send, Stethoscope } from "lucide-react";
import type { NurseKpis } from "./nurse-overview-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./nurse-overview.module.css";

export function NurseOverviewKpis({ kpis }: { kpis: NurseKpis }) {
  const rows = [
    {
      label: "Needs review",
      hint: "pending cases on your desk",
      value: kpis.needsReview,
      Icon: Stethoscope,
    },
    {
      label: "Booked session",
      hint: "cases with an active booking",
      value: kpis.bookedSession,
      Icon: CalendarClock,
    },
    {
      label: "Endorsed to ADM coordinator",
      hint: "sent to the coordinator",
      value: kpis.endorsedToAdm,
      Icon: Send,
    },
    {
      label: "Follow-up",
      hint: "awaiting follow-up",
      value: kpis.followUp,
      Icon: Activity,
    },
    {
      label: "Done session",
      hint: "cases with a completed session",
      value: kpis.doneSession,
      Icon: CheckCircle2,
    },
  ];

  return (
    <div className={styles.railStack}>
      <div className={assign.card} aria-label="Clinic snapshot">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Stethoscope size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">Clinic snapshot</h3>
            <p className="text-xs text-muted-foreground">
              {kpis.total} case{kpis.total === 1 ? "" : "s"} on your desk.
            </p>
          </div>
        </div>
        <ul className="relative m-0 flex list-none flex-col p-0">
          {rows.map((row) => (
            <li key={row.label} className={styles.kpiRow}>
              <span className={styles.kpiRowIcon} aria-hidden="true">
                <row.Icon size={16} strokeWidth={1.8} />
              </span>
              <span className={styles.kpiRowBody}>
                <span className={styles.kpiRowLabel}>{row.label}</span>
                <span className={styles.kpiRowHint}>{row.hint}</span>
              </span>
              <span className={styles.kpiRowValue}>{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
