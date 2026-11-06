"use client";

import { OverviewShortcuts } from "@/components/registry/overview/OverviewShortcuts";
import { OverviewKpiRail } from "@/components/registry/overview/OverviewKpiRail";
import { Sf10AttachFeed } from "@/components/registry/overview/Sf10AttachFeed";
import { FinalGradeApprovals } from "@/components/registry/overview/FinalGradeApprovals";
import { OverviewGradeChart } from "@/components/registry/overview/OverviewGradeChart";
import { Sf10RequestsChart } from "@/components/registry/overview/Sf10RequestsChart";
import styles from "./components/overview.module.css";

// Mirror of /record-keeper/overview — same cards, rail, motion; every widget
// is desk-scoped, so this page reads the G11–12 band while the record keeper
// page reads G7–10.
export default function RegistrarOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <OverviewShortcuts desk="registrar" variant="stats" />

          <div className={styles.duo}>
            <Sf10AttachFeed desk="registrar" variant="kanban" />
            <FinalGradeApprovals desk="registrar" variant="kanban" />
          </div>

          <div className={styles.duo}>
            <OverviewGradeChart desk="registrar" variant="kanban" />
            <Sf10RequestsChart desk="registrar" />
          </div>
        </div>
        <OverviewKpiRail desk="registrar" />
      </div>
    </section>
  );
}
