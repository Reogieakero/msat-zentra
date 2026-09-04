"use client";

import styles from "./GradeFlagsHeader.module.css";

export function GradeFlagsHeader() {
  return (
    <div className={styles.hero}>
      <h1 className={styles.heroTitle}>Grade Flags</h1>
      <p className={styles.heroSubtitle}>
        Flags you raised on student grades, and flags raised against your gradebook.
      </p>
    </div>
  );
}
