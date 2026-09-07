"use client";

import styles from "./AdmCasesHeader.module.css";

interface AdmCasesHeaderProps {
  pending: number;
  approved: number;
}

export function AdmCasesHeader({ pending, approved }: AdmCasesHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>ADM Cases</h1>
        <p className={styles.subtitle}>
          Your advisees in the ADM pipeline — {pending} pending approval, {approved}{" "}
          approved. Stage and status only, never confidential detail.
        </p>
      </div>
    </div>
  );
}
