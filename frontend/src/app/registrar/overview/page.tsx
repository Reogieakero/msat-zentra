"use client";

import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewApprovals } from "./components/OverviewApprovals";
import { Sf10AttachFeed } from "./components/Sf10AttachFeed";
import { FinalGradeApprovals } from "./components/FinalGradeApprovals";
import { Sf10Coverage } from "./components/Sf10Coverage";
import { AccountBreakdown } from "./components/AccountBreakdown";
import styles from "./components/overview.module.css";

export default function RegistrarOverviewPage() {
  return (
    <section className={styles.page}>
      <OverviewHeader />

      <hr className={styles.divider} />

      <OverviewApprovals />

      <hr className={styles.divider} />

      <div className={styles.row}>
        <Sf10AttachFeed />
        <FinalGradeApprovals />
      </div>

      <hr className={styles.divider} />

      <Sf10Coverage />

      <hr className={styles.divider} />

      <AccountBreakdown />
    </section>
  );
}