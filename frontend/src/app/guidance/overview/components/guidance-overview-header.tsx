"use client";

import styles from "./guidance-overview-header.module.css";

interface GuidanceOverviewHeaderProps {
  counselorName: string;
}

export function GuidanceOverviewHeader({ counselorName }: GuidanceOverviewHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>Guidance overview</h1>
        <p className={styles.lede}>
          Live caseload for {counselorName} — referrals routed to guidance, open
          interventions, at-risk students, and ADM hand-offs. Gradebooks and
          report cards stay view-only for this role.
        </p>
      </div>
    </div>
  );
}
