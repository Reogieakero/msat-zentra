"use client";

import * as React from "react";
import { RiskLevelDonutCard } from "./components/RiskLevelDonutCard";
import { RiskLevelBreakdown } from "./components/RiskLevelBreakdown";
import { RiskLevelDistribution } from "./components/RiskLevelDistribution";
import { RiskTrend } from "./components/RiskTrend";
import { HighRiskStudentsTable } from "./components/HighRiskStudentsTable";
import { InterventionTrackingTable } from "./components/InterventionTrackingTable";
import styles from "./risk.module.css";

export default function PrincipalRiskBoardPage() {
  return (
    <section className={styles.page}>
      <div className={styles.topSummary}>
        <RiskLevelDonutCard />
        <RiskLevelBreakdown />
      </div>

      <HighRiskStudentsTable />

      <hr className={styles.divider} />

      <RiskLevelDistribution />

      <hr className={styles.divider} />

      <RiskTrend />

      <hr className={styles.divider} />

      <InterventionTrackingTable />
    </section>
  );
}
