"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewPopulation } from "./components/OverviewPopulation";
import { PrincipalOverviewStats } from "./components/PrincipalOverviewStats";
import { PrincipalOverviewRail } from "./components/PrincipalOverviewRail";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  const { activeTerm, termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const loading = isPending || !termReady;

  // Nothing to report (no sections, enrollment, or filed records) → one
  // centered callout instead of zero-filled boards and tables.
  const isEmpty =
    !loading &&
    !!data &&
    data.kpis.activeSections === 0 &&
    data.kpis.enrollment === 0 &&
    data.kpis.anecdotals === 0;

  return (
    <section className={styles.page} aria-busy={loading || undefined}>
      {isEmpty ? (
        <PageEmptyCallout>
          No school data for the selected term yet. Sections, enrollment, and
          risk signals will appear here once classes start.
        </PageEmptyCallout>
      ) : (
        <div className={styles.layout}>
          <div className={styles.stack}>
            <PrincipalOverviewStats />

            <OverviewRisk />

            <OverviewPopulation />
          </div>

          <PrincipalOverviewRail />
        </div>
      )}
    </section>
  );
}
