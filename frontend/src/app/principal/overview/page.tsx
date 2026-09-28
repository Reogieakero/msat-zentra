"use client";

import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewAction } from "./components/OverviewAction";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewPopulation } from "./components/OverviewPopulation";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <OverviewRisk />

          <OverviewPopulation />

          <OverviewAction />
        </div>

        <OverviewHeader />
      </div>
    </section>
  );
}
