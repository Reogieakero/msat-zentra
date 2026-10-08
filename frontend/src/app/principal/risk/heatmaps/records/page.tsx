"use client";

import { RecordsHeatblocks } from "./components/RecordsHeatblocks";
import { RecordsBreakdown } from "./components/RecordsBreakdown";
import { PrincipalPageHeader } from "../../../components/PrincipalPageHeader";
import styles from "./components/records.module.css";

export default function PrincipalRecordsPage() {
  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="Records Heatmap"
        description="A school-wide view of behavioral records across every grade and section — with category heatblocks, severity flags, and follow-ups."
      />
      <div className={styles.topRow}>
        <RecordsHeatblocks />

        <RecordsBreakdown />
      </div>
    </section>
  );
}
