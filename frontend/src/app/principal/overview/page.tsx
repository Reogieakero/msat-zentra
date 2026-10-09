"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchOverview } from "@/services/principal/overview.service";
import { OverviewAction } from "./components/OverviewAction";
import { OverviewRisk } from "./components/OverviewRisk";
import { OverviewPopulation } from "./components/OverviewPopulation";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./components/overview.module.css";

export default function PrincipalOverviewPage() {
  const { activeTerm, termReady } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["overview", activeTerm?.termId ?? null],
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const totalRecords =
    (data?.atRisk?.students ?? 0) +
    (data?.riskByLevel?.high ?? 0) +
    (data?.riskByLevel?.moderate ?? 0) +
    (data?.riskByLevel?.low ?? 0) +
    (data?.sections ?? []).reduce((sum, r) => sum + r.count, 0) +
    (data?.admPending ?? 0) +
    (data?.attendanceWatch ?? 0) +
    (data?.honorRoll ?? 0);
  const isEmpty = !isPending && !isError && !!data && totalRecords === 0;
  const headerLoading = isPending || !termReady;
  return (
    <section className={styles.page} aria-busy={headerLoading || undefined}>
      {headerLoading ? (
        <PageHeaderSkeleton />
      ) : isEmpty ? null : (
      <PrincipalPageHeader
        title="Overview"
        description="School health at a glance — risk, enrollment, and actions that need you."
      />
      )}
      <div className={styles.layout}>
        <div className={styles.main}>
          <OverviewRisk />

          <OverviewPopulation />

          <OverviewAction />
        </div>
      </div>
    </section>
  );
}
