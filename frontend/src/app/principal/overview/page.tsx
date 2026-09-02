"use client";

import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewAction } from "./components/OverviewAction";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewAttendance } from "./components/OverviewAttendance";
import { OverviewPopulation } from "./components/OverviewPopulation";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  return (
    <section className={styles.page}>
      <OverviewHeader />

      <hr className={styles.divider} />

      <OverviewAction />

      <OverviewRisk />

      <OverviewAttendance />

      <OverviewPopulation />
    </section>
  );
}