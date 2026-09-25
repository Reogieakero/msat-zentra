"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTeacherOverview,
  useTeacherOverviewSecondary,
} from "../overview/components/teacher-overview-data";
import { GradebookCards } from "./components/GradebookCards";
import styles from "./components/gradebook.module.css";

export default function TeacherGradebookPage() {
  // Critical (identity + classes) paints first; assessments/standings stream
  // in progressively so the first usable UI never waits on aggregations.
  const critical = useTeacherOverview();
  const secondary = useTeacherOverviewSecondary(critical.isSuccess);

  if (critical.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading gradebook">
        <div className={styles.skelGrid} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelSubject} />
              <Skeleton className={styles.skelMeta} />
              <div className={styles.skelStats}>
                <Skeleton className={styles.skelStat} />
                <Skeleton className={styles.skelStat} />
              </div>
              <Skeleton className={styles.skelBar} />
              <div className={styles.skelFoot}>
                <Skeleton className={styles.skelBtn} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (critical.isError || !critical.data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your gradebook. Check your connection and try again.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {secondary.isPending ? (
        <p className={styles.syncNote} role="status">
          Loading assessments…
        </p>
      ) : null}
      <GradebookCards
        classes={critical.data.classes}
        assessments={secondary.data?.assessments ?? []}
        standings={secondary.data?.standings ?? []}
      />
      {secondary.isFetching && !secondary.isPending ? (
        <p className={styles.syncNote} role="status" aria-live="polite">
          Updating assessments…
        </p>
      ) : null}
    </section>
  );
}
