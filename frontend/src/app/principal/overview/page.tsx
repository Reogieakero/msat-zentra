"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewPopulation } from "./components/OverviewPopulation";
import { PrincipalOverviewStats } from "./components/PrincipalOverviewStats";
import { PrincipalOverviewRail } from "./components/PrincipalOverviewRail";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  const { activeTerm, termReady } = useTerm();
  const { isPending } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const loading = isPending || !termReady;
  return (
    <section className={styles.page} aria-busy={loading || undefined}>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <PrincipalOverviewStats />

          <OverviewRisk />

          <OverviewPopulation />
        </div>

        <PrincipalOverviewRail />
      </div>
    </section>
  );
}
