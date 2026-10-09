"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { RiskLevelDonutCard } from "./components/RiskLevelDonutCard";
import { RiskLevelBreakdown } from "./components/RiskLevelBreakdown";
import { RiskLevelDistribution } from "./components/RiskLevelDistribution";
import { RiskTrend } from "./components/RiskTrend";
import { HighRiskStudentsTable } from "./components/HighRiskStudentsTable";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./risk.module.css";

export default function PrincipalRiskBoardPage() {
  const { activeTerm, termReady } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["risk-board", activeTerm?.termId ?? null, activeTerm?.schoolYearId ?? null],
    queryFn: async () => {
      const res = await apiClient.get<{ levelDistribution?: { count: number }[] }>("/api/risk/board");
      return res.data;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const total = (data?.levelDistribution ?? []).reduce((sum, d) => sum + d.count, 0);
  const isEmpty = !isPending && !isError && total === 0;
  const headerLoading = isPending || !termReady;
  return (
    <section className={styles.page} aria-busy={headerLoading || undefined}>
      {headerLoading ? (
        <PageHeaderSkeleton />
      ) : isEmpty ? null : (
      <PrincipalPageHeader
        title="Risk Overview"
        description="Students by risk level, trends, and interventions being tracked school-wide."
      />
      )}
      <div className={styles.topSummary}>
        <RiskLevelDonutCard />
        <RiskLevelBreakdown />
      </div>

      <HighRiskStudentsTable />

      <hr className={styles.divider} />

      <RiskLevelDistribution />

      <hr className={styles.divider} />

      <RiskTrend />
    </section>
  );
}
