"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchInterventionStudents } from "@/services/principal/riskInterventions.service";
import { InterventionsListTable } from "./components/InterventionsListTable";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";
import { PrincipalPageHeader as Header } from "../../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../../components/skeletons/PageHeaderSkeleton";

export default function PrincipalInterventionsPage() {
  const { activeTerm, termReady } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { data, isPending, isError } = useQuery({
    queryKey: ["interventions-list", termId, schoolYearId],
    queryFn: () => fetchInterventionStudents({}, 1, 50),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const isEmpty = !isPending && !isError && (data?.students ?? []).length === 0;
  const headerLoading = isPending || !termReady;
  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section className={styles.page} aria-busy={headerLoading || undefined}>
          {headerLoading ? (
            <PageHeaderSkeleton />
          ) : isEmpty ? null : (
          <Header
            title="Intervention Cases"
            description="Flagged by the system. Category only, never the private write-up."
          />
          )}
          <InterventionsListTable />
        </section>
      </div>
    </div>
  );
}
