"use client";

import { OverviewShortcuts } from "@/components/registry/overview/OverviewShortcuts";
import { OverviewApprovals } from "./components/OverviewApprovals";
import { Sf10AttachFeed } from "@/components/registry/overview/Sf10AttachFeed";
import { FinalGradeApprovals } from "@/components/registry/overview/FinalGradeApprovals";
import { OverviewGradeChart } from "@/components/registry/overview/OverviewGradeChart";
import { AccountBreakdown } from "@/components/registry/overview/AccountBreakdown";
import { MissingSf10Table } from "@/components/registry/overview/MissingSf10Table";
import { AdviserAccessCard } from "@/components/registry/overview/AdviserAccessCard";
import styles from "./components/overview.module.css";

export default function RecordKeeperOverviewPage() {
  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <OverviewShortcuts desk="record-keeper" />

        <OverviewApprovals />

        <div className={styles.duo}>
          <Sf10AttachFeed desk="record-keeper" />
          <FinalGradeApprovals desk="record-keeper" />
        </div>

        <div className={styles.duo}>
          <OverviewGradeChart desk="record-keeper" />
          <AccountBreakdown desk="record-keeper" />
        </div>

        <div className={styles.duo}>
          <MissingSf10Table desk="record-keeper" />
          <AdviserAccessCard desk="record-keeper" />
        </div>
      </div>
    </section>
  );
}
