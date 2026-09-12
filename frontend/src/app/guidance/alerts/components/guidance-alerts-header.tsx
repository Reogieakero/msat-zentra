"use client";

import styles from "./guidance-alerts-header.module.css";

export function GuidanceAlertsHeader() {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>Alerts</h1>
        <p className={styles.lede}>
          Live rule-engine flags — academic average below 75, attendance below
          80%, or at least one behavioral report this term. Follow up through
          referrals or interventions.
        </p>
      </div>
    </div>
  );
}
