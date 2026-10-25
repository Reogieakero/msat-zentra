"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchInterventionStudents } from "@/services/principal/riskInterventions.service";
import { InterventionsListTable } from "./components/InterventionsListTable";
import menu from "../heatmaps/components/heatmap.module.css";
import styles from "./interventions.module.css";

export default function PrincipalInterventionsPage() {
  const { activeTerm, termReady } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { isPending } = useQuery({
    queryKey: ["interventions-list", termId, schoolYearId],
    queryFn: () => fetchInterventionStudents({}, 1, 50),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section
          className={styles.page}
          aria-busy={isPending || !termReady || undefined}
        >
          <InterventionsListTable />
        </section>
      </div>
    </div>
  );
}
