"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import type { RiskBoardData } from "@/services/principal/risk.types";
import { RiskLevelDonutCard } from "./components/RiskLevelDonutCard";
import { RiskLevelBreakdown } from "./components/RiskLevelBreakdown";
import { RiskLevelDistribution } from "./components/RiskLevelDistribution";
import { RiskTrend } from "./components/RiskTrend";
import { HighRiskStudentsTable } from "./components/HighRiskStudentsTable";
import styles from "./risk.module.css";

export default function PrincipalRiskBoardPage() {
  const { activeTerm } = useTerm();
  // Same key/endpoint the boards read, so this only observes their cache: the
  // page-level empty state replaces the per-board "no data" messages.
  const { data, isPending } = useQuery({
    queryKey: ["risk-board", activeTerm?.termId ?? null, activeTerm?.schoolYearId ?? null],
    queryFn: async () => {
      const res = await apiClient.get<RiskBoardData>("/api/risk/board");
      return res.data;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const total = (data?.levelDistribution ?? []).reduce(
    (sum, level) => sum + level.count,
    0,
  );

  if (!isPending && data && total === 0) {
    return (
      <section className={styles.page}>
        <PageEmptyCallout>
          No risk flags for the active term yet. Students flagged by the
          academic, attendance, or behavioral rules will appear here once
          detected.
        </PageEmptyCallout>
      </section>
    );
  }

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
