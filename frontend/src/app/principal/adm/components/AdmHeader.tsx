"use client";

import styles from "./AdmHeader.module.css";

export function AdmHeader() {
  return (
    <div className={styles.hero}>
      <h1 className={styles.heroTitle}>ADM Cases</h1>
      <p className={styles.heroSubtitle}>
        Alternate Delivery Mode learner profiles — review referrals, track
        approvals, and monitor learner progress across the ADM pipeline.
      </p>
    </div>
  );
}
