"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { ADM_PIPELINE } from "../adm";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { useTerm } from "@/lib/term/TermContext";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./AdmPipelineOverview.module.css";

export function AdmPipelineOverview() {
  const { termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const getCount = (stage: string) => {
    if (isPending || !data) return 0;
    return data.stageBreakdown.find((s) => s.stage === stage)?.count ?? 0;
  };

  const total = (data?.stageBreakdown ?? []).reduce((sum, s) => sum + s.count, 0);
  if (isPending) {
    return (
      <section className={styles.section} aria-label="Loading pipeline" aria-busy="true">
        <h2 className={styles.heading}>Pipeline Stages</h2>
        <div className={styles.track} aria-hidden="true">
          {ADM_PIPELINE.map((step) => (
            <div key={step.stage} className={styles.stage}>
              <Skeleton className="size-8 rounded-full" />
              <div className={styles.body}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (total === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Pipeline Stages</h2>
        <PrincipalEmptyState
          icon={Inbox}
          title="No ADM cases this term"
          hint="No ADM referrals on file. Endorsed cases will appear here once filed."
        />
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Pipeline Stages</h2>
      <div className={styles.track}>
        {ADM_PIPELINE.map((step, i) => {
          const count = getCount(step.stage);
          const isLast = i === ADM_PIPELINE.length - 1;
          return (
            <React.Fragment key={step.stage}>
              <div className={styles.stage}>
                <span className={styles.marker}>{step.order}</span>
                <div className={styles.body}>
                  <span className={styles.label}>{step.label}</span>
                  <span className={styles.count}>{count}</span>
                </div>
              </div>
              {!isLast && <span className={styles.connector} aria-hidden />}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
