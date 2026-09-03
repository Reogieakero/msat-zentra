"use client";

import * as React from "react";
import styles from "./GradePipeline.module.css";

const STAGES = [
  {
    key: "locked",
    order: 1,
    label: "Final Grade Locked",
    owner: "Subject Teacher",
    color: "#f59e0b",
  },
  {
    key: "adviserApproved",
    order: 2,
    label: "Adviser Approved",
    owner: "Class Adviser",
    color: "#3b82f6",
  },
  {
    key: "complete",
    order: 3,
    label: "Complete Set Ready",
    owner: "Record Keeper",
    color: "#10b981",
  },
] as const;

export type GradePipelineCounts = {
  locked?: number;
  adviserApproved?: number;
  complete?: number;
};

interface GradePipelineProps {
  counts: GradePipelineCounts;
  isLoading?: boolean;
}

export function GradePipeline({ counts, isLoading }: GradePipelineProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Final Grade Approval Pipeline</h2>
      <p className={styles.subheading}>
        Grades move from the subject teacher to the adviser; the record keeper is view-only
        once a student&apos;s full term is adviser-approved.
      </p>
      <div className={styles.track}>
        {STAGES.map((step, i) => {
          const isLast = i === STAGES.length - 1;
          const count = counts[step.key];
          return (
            <React.Fragment key={step.key}>
              <div className={styles.stage}>
                <span
                  className={styles.marker}
                  style={{ backgroundColor: step.color }}
                >
                  {step.order}
                </span>
                <div className={styles.body}>
                  <span className={styles.label}>{step.label}</span>
                  <span className={styles.owner}>{step.owner}</span>
                  <span className={styles.count}>
                    {isLoading ? "…" : (count ?? 0)}
                  </span>
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
