"use client";

import styles from "./guidance-anecdotal-header.module.css";

export function GuidanceAnecdotalHeader() {
  return (
    <div className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Records · Confidentiality-aware</p>
        <h1 className={styles.title}>Anecdotal records</h1>
        <p className={styles.lede}>
          Only filings advisers referred to you — unreferred write-ups stay
          with the filer. Full case files open from the linked referral.
        </p>
      </div>
    </div>
  );
}
