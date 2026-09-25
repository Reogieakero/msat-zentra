"use client";

import * as React from "react";
import styles from "./GradePipeline.module.css";

const STAGES = [
  {
    key: "locked",
    order: 1,
    label: "Final Grade Locked",
    owner: "Subject Teacher",
    color: "#a3a3a3",
  },
  {
    key: "adviserApproved",
    order: 2,
    label: "Adviser Approved",
    owner: "Class Adviser",
    color: "#525252",
  },
  {
    key: "complete",
    order: 3,
    label: "Complete Set Ready",
    owner: "Registrar",
    color: "#171717",
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
  orientation?: "horizontal" | "vertical";
}

export function GradePipeline({ counts, isLoading, orientation = "horizontal" }: GradePipelineProps) {
  const vertical = orientation === "vertical";
  return (
    <section className={`${styles.section} ${vertical ? styles.sectionVertical : ""}`}>
      <h2 className={styles.heading}>Final Grade Approval Pipeline</h2>
      <p className={styles.subheading}>
        Grades move from the subject teacher to the adviser; the registrar is view-only
        once a student&apos;s full term is adviser-approved.
      </p>
      <div className={`${styles.track} ${vertical ? styles.trackVertical : ""}`}>
        {STAGES.map((step, i) => {
          const isLast = i === STAGES.length - 1;
          const count = counts[step.key];
          return (
            <React.Fragment key={step.key}>
              <div className={`${styles.stage} ${vertical ? styles.stageVertical : ""}`}>
                <span
                  className={styles.marker}
                  style={{ backgroundColor: step.color }}
                >
                  {step.order}
                </span>
                <div className={`${styles.body} ${vertical ? styles.bodyVertical : ""}`}>
                  <span className={styles.label}>{step.label}</span>
                  <span className={styles.owner}>{step.owner}</span>
                  <span className={styles.count}>
                    {isLoading ? "…" : (count ?? 0)}
                  </span>
                </div>
              </div>
              {!isLast && (
                <span
                  className={`${styles.connector} ${vertical ? styles.connectorVertical : ""}`}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}