"use client";

import { OverviewShortcuts } from "@/components/registry/overview/OverviewShortcuts";
import { OverviewKpiRail } from "@/components/registry/overview/OverviewKpiRail";
import { Sf10AttachFeed } from "@/components/registry/overview/Sf10AttachFeed";
import { FinalGradeApprovals } from "@/components/registry/overview/FinalGradeApprovals";
import { OverviewGradeChart } from "@/components/registry/overview/OverviewGradeChart";
import { Sf10RequestsChart } from "@/components/registry/overview/Sf10RequestsChart";
import styles from "./components/overview.module.css";

export default function RecordKeeperOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <OverviewShortcuts desk="record-keeper" variant="stats" />

          <div className={styles.duo}>
            <Sf10AttachFeed desk="record-keeper" variant="kanban" />
            <FinalGradeApprovals desk="record-keeper" variant="kanban" />
          </div>

          <div className={styles.duo}>
            <OverviewGradeChart desk="record-keeper" variant="kanban" />
            <Sf10RequestsChart desk="record-keeper" />
          </div>
        </div>
        <OverviewKpiRail desk="record-keeper" />
      </div>
    </section>
  );
}
