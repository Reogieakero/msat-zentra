"use client";

import { useQuery } from "@tanstack/react-query";
import { FileBarChart2 } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { PrincipalEmptyCard } from "../components/PrincipalEmptyCard";
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
        <PrincipalEmptyCard
          icon={FileBarChart2}
          title="No ADM cases school-wide"
          hint="ADM trends, stage mix, and risk signals will appear here once cases are filed."
          label="ADM report"
          centered
          layout="fit"
        />
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
