"use client";

import styles from "./guidance-referrals-header.module.css";

export function GuidanceReferralsHeader() {
  return (
    <div className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Cases · Referred to me</p>
        <h1 className={styles.title}>Referrals to guidance</h1>
        <p className={styles.lede}>
          Every behavior and incident report advisers routed to you. Accept a
          case to start work, resolve it when follow-through is done.
        </p>
      </div>
    </div>
  );
}
