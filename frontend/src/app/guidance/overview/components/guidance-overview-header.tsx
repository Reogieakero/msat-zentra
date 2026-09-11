"use client";

import { Badge } from "@/components/ui/badge";
import styles from "./guidance-overview-header.module.css";

interface GuidanceOverviewHeaderProps {
  counselorName: string;
  termLabel: string;
}

export function GuidanceOverviewHeader({ counselorName, termLabel }: GuidanceOverviewHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Guidance Counselor · Overview</p>
        <h1 className={styles.title}>Guidance overview</h1>
        <p className={styles.lede}>
          Live caseload for {counselorName} — referrals routed to guidance, open
          interventions, at-risk students, and ADM hand-offs. Gradebooks and
          report cards stay view-only for this role.
        </p>
      </div>
      <Badge variant="outline" className={styles.liveBadge}>
        Live · {termLabel}
      </Badge>
    </div>
  );
}
