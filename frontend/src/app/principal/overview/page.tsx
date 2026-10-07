"use client";

import { OverviewAction } from "./components/OverviewAction";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewPopulation } from "./components/OverviewPopulation";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="Overview"
        description="School health at a glance — risk, enrollment, and actions that need you."
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          <OverviewRisk />

          <OverviewPopulation />

          <OverviewAction />
        </div>
      </div>
    </section>
  );
}
