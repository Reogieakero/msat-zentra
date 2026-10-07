"use client";

import * as React from "react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./GradePipeline.module.css";

// Shared final-grade pipeline ramp (registrar + record-keeper desks).
// The final stage owner label differs per desk; everything else is
// identical.
import type { RegistryDesk } from "@/services/registry/overview.service";
const STAGES = [
  {
    key: "locked",
    order: 1,
    label: "Final Grade Locked",
    owner: "Subject Teacher",
    color: "color-mix(in oklch, var(--primary) 40%, var(--card))",
    text: "var(--foreground)",
  },
  {
    key: "adviserApproved",
    order: 2,
    label: "Adviser Approved",
    owner: "Class Adviser",
    color: "color-mix(in oklch, var(--primary) 70%, var(--card))",
    text: "var(--foreground)",
  },
  {
    key: "complete",
    order: 3,
    label: "Complete Set Ready",
    owner: "Registrar",
    color: "var(--primary)",
    text: "var(--primary-foreground)",
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

export function GradePipeline({
  counts,
  isLoading,
  orientation = "horizontal",
  desk,
}: GradePipelineProps & { desk: RegistryDesk }) {
  const vertical = orientation === "vertical";
  const stages = STAGES.map((s) =>
    s.key === "complete" ? { ...s, owner: desk === "registrar" ? "Registrar" : "Record Keeper" } : s
  );
  return (
    <section className={assign.card} aria-labelledby="finals-pipeline">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 id="finals-pipeline" className="text-base font-semibold">
          Final Grade Approval Pipeline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Grades move from the subject teacher to the adviser; the {desk === "registrar" ? "registrar" : "record keeper"} is view-only
          once a student&apos;s full term is adviser-approved.
        </p>
      </div>
      <div className={`${styles.track} ${vertical ? styles.trackVertical : ""} relative`}>
        {stages.map((step, i) => {
          const isLast = i === stages.length - 1;
          const count = counts[step.key];
          return (
            <React.Fragment key={step.key}>
              <div className={`${styles.stage} ${vertical ? styles.stageVertical : ""}`}>
                <span
                  className={styles.marker}
                  style={{ backgroundColor: step.color, color: step.text }}
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
