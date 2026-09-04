"use client";

import styles from "./ClassesHeader.module.css";

export function ClassesHeader() {
  return (
    <div className={styles.hero}>
      <h1 className={styles.heroTitle}>My Classes</h1>
      <p className={styles.heroSubtitle}>
        The class sections assigned to you and the students in each one.
      </p>
    </div>  );
}
