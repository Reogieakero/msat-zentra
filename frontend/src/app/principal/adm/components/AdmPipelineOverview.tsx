"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ADM_PIPELINE, STAGE_COLORS } from "../adm";
import { fetchAdmDashboard } from "../api";
import styles from "./AdmPipelineOverview.module.css";

export function AdmPipelineOverview() {
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
  });

  const getCount = (stage: string) => {
    if (isPending || !data) return 0;
    return data.stageBreakdown.find((s) => s.stage === stage)?.count ?? 0;
  };

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
                <span
                  className={styles.marker}
                  style={{ backgroundColor: STAGE_COLORS[step.stage] }}
                >
                  {step.order}
                </span>
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
