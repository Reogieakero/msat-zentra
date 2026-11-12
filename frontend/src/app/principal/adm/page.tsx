"use client";

import { useQuery } from "@tanstack/react-query";
import { useTerm } from "@/lib/term/TermContext";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { AdmPageSkeleton } from "./components/AdmPageSkeleton";
import { AdmStats } from "./components/AdmStats";
import { AdmReports } from "./components/AdmReports";
import { AdmInsights } from "./components/AdmInsights";
import { AdmRisk } from "./components/AdmRisk";
import { AdmAttentionRail } from "./components/AdmAttentionRail";
import layoutStyles from "./components/admAttentionRail.module.css";
import styles from "../../guidance/adm/components/guidance-adm.module.css";

export default function PrincipalAdmPage() {
  const { termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  if (!termReady || isPending) {
    return <AdmPageSkeleton />;
  }

  const total = (data?.stageBreakdown ?? []).reduce((sum, s) => sum + s.count, 0);

  return (
    <section className={styles.page} aria-label="ADM report">
      {!data || total === 0 ? (
        <PageEmptyCallout>
          No ADM cases school-wide yet. ADM trends, stage mix, and risk signals
          will appear here once cases are filed.
        </PageEmptyCallout>
      ) : (
        <div className={layoutStyles.layout}>
          <div className={layoutStyles.stack}>
            <AdmStats />
            <AdmReports />
            <AdmInsights dashboard={data} />
            <AdmRisk />
          </div>
          <AdmAttentionRail />
        </div>
      )}
    </section>
  );
}
