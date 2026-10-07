"use client";

import { OverviewShortcuts } from "./components/OverviewShortcuts";
import { OverviewApprovals } from "./components/OverviewApprovals";
import { Sf10AttachFeed } from "./components/Sf10AttachFeed";
import { FinalGradeApprovals } from "./components/FinalGradeApprovals";
import { OverviewGradeChart } from "./components/OverviewGradeChart";
import { AccountBreakdown } from "./components/AccountBreakdown";
import { MissingSf10Table } from "./components/MissingSf10Table";
import { AdviserAccessCard } from "./components/AdviserAccessCard";
import styles from "./components/overview.module.css";

export default function RegistrarOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <OverviewShortcuts />

        <OverviewApprovals />

        <div className={styles.duo}>
          <Sf10AttachFeed />
          <FinalGradeApprovals />
        </div>

        <div className={styles.duo}>
          <OverviewGradeChart />
          <AccountBreakdown />
        </div>

        <div className={styles.duo}>
          <MissingSf10Table />
          <AdviserAccessCard />
        </div>
      </div>
    </section>
  );
}
