"use client";

import * as React from "react";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./GradePipeline.module.css";

import type { RegistryDesk } from "@/services/registry/overview.service";
const STAGES = [
  {
    key: "locked",
    order: 1,
    label: "Final Grade Locked",
    owner: "Subject Teacher",
  },
  {
    key: "complete",
    order: 2,
    label: "Complete Set Ready",
    owner: "Record Keeper",
  },
] as const;

export type GradePipelineCounts = {
  locked?: number;
  complete?: number;
};

interface GradePipelineProps {
  counts: GradePipelineCounts;
  isLoading?: boolean;
  orientation?: "horizontal" | "vertical";
  /**
   * Embedded variant — renders only the stage track (no glow card, no
   * heading); the caller supplies the surface and title. Used by the
   * record-keeper pipeline rail flyout.
   */
  embedded?: boolean;
}

export function GradePipeline({
  counts,
  isLoading,
  orientation = "horizontal",
  embedded = false,
  desk,
}: GradePipelineProps & { desk: RegistryDesk }) {
  const vertical = orientation === "vertical";
  const stages = STAGES.map((s) =>
    s.key === "complete" ? { ...s, owner: desk === "registrar" ? "Registrar" : "Record Keeper" } : s
  );

  const track = (
    <div className={`${styles.track} ${vertical ? styles.trackVertical : ""} relative`}>
      {stages.map((step, i) => {
        const isLast = i === stages.length - 1;
        const count = counts[step.key];
        return (
          <React.Fragment key={step.key}>
            <div className={`${styles.stage} ${vertical ? styles.stageVertical : ""}`}>
              <span className={styles.marker}>{step.order}</span>
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
  );

  if (embedded) return track;

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
          Grades lock at the subject teacher — the {desk === "registrar" ? "registrar" : "record keeper"} is view-only
          once a student&apos;s full term is complete.
        </p>
      </div>
      {track}
    </section>
  );
}
