"use client";

import { AlertTriangle, Activity } from "lucide-react";
import { StatCard } from "./components/StatCard";
import { RiskLevelDonut } from "./components/RiskLevelDonut";
import { RiskTrendChart } from "./components/RiskTrendChart";
import { RiskFactorHeatmap } from "./components/RiskFactorHeatmap";
import { OutcomeSummary } from "./components/OutcomeSummary";
import { LowRiskStudents } from "./components/LowRiskStudents";
import { useRiskBoard } from "./riskBoard";
import styles from "./risk.module.css";

export default function PrincipalRiskBoardPage() {
  const { data, loading, error } = useRiskBoard();

  const totalAtRiskFlags = data?.kpis.totalAtRiskFlags ?? 0;
  const highRiskStudents = data?.kpis.highRiskStudents ?? 0;

  return (
    <section className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Board Risk</h1>
          <p className={styles.subtitle}>
            School-wide early-intervention overview · status-only view
          </p>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.kpiRow}>
        <StatCard
          label="Total at-risk flags"
          value={loading ? "—" : String(totalAtRiskFlags)}
          hint="across all factors"
          icon={AlertTriangle}
          accent="var(--destructive)"
          loading={loading}
        />
        <StatCard
          label="High-risk students"
          value={loading ? "—" : String(highRiskStudents)}
          hint="need priority review"
          icon={Activity}
          accent="#b91c1c"
          loading={loading}
        />
        <RiskLevelDonut
          data={data?.levelDistribution ?? null}
          loading={loading}
        />
        <RiskTrendChart data={data?.trend ?? null} loading={loading} />
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          <RiskFactorHeatmap />
        </div>
        <aside className={styles.rail}>
          <OutcomeSummary
            outcome={data?.interventionOutcome ?? null}
            factorTotals={data?.factorTotals ?? null}
            loading={loading}
          />
          <LowRiskStudents />
        </aside>
      </div>
    </section>
  );
}
