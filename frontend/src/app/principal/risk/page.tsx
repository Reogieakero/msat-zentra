"use client";

import { RiskLevelDonutCard } from "./components/RiskLevelDonutCard";
import { RiskLevelBreakdown } from "./components/RiskLevelBreakdown";
import { RiskLevelDistribution } from "./components/RiskLevelDistribution";
import { RiskTrend } from "./components/RiskTrend";
import { HighRiskStudentsTable } from "./components/HighRiskStudentsTable";
import styles from "./risk.module.css";

export default function PrincipalRiskBoardPage() {
  return (
    <section className={styles.page}>
      <div className={styles.topSummary}>
        <RiskLevelDonutCard />
        <RiskLevelBreakdown />
      </div>

      <RiskLevelDistribution />

      <RiskTrend />

      <HighRiskStudentsTable />
    </section>
  );
}
