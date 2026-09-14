"use client";

import styles from "./nurse-overview.module.css";

export function NurseOverviewHeader({ total }: { total: number }) {
  return (
    <div>
      <p className={styles.eyebrow}>School Nurse · Overview</p>
      <h1 className={styles.title}>Clinic overview</h1>
      <p className={styles.lede}>
        Cases sent to the clinic that need your attention, plus a breakdown of
        your caseload. {total === 0
          ? "No cases have been routed to the nurse yet."
          : `${total} case${total === 1 ? " has" : "s have"} been routed to the nurse.`}
      </p>
    </div>
  );
}
