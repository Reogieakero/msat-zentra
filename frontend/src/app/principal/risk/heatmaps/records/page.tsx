"use client";

import { RecordsHeatblocks } from "./components/RecordsHeatblocks";
import { RecordsBreakdown } from "./components/RecordsBreakdown";
import styles from "./components/records.module.css";

export default function PrincipalRecordsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <RecordsHeatblocks />

        <RecordsBreakdown />
      </div>
    </section>
  );
}