"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherOverviewGradebook } from "@/services/teacher/overview.service";
import { GradebookCards } from "./components/GradebookCards";
import styles from "./components/gradebook.module.css";

export default function TeacherGradebookPage() {
  // Lean gradebook scope: classes + assessments + standings in one request
  // (no risk scans, no advisory engine), so the cards paint from a single
  // round trip instead of waiting on critical + secondary.
  const gradebook = useTeacherOverviewGradebook();

  if (gradebook.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading gradebook">
        <div className={styles.skelGrid} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelSubject} />
              <Skeleton className={styles.skelMeta} />
              <div className={styles.skelStats}>
                {[0, 1].map((s) => (
                  <div key={s} className={styles.skelStatCol}>
                    <Skeleton className={styles.skelStatValue} />
                    <Skeleton className={styles.skelStatLabel} />
                  </div>
                ))}
              </div>
              <Skeleton className={styles.skelBar} />
              <Skeleton className={styles.skelProgressLabel} />
              <div className={styles.skelFoot}>
                <Skeleton className={styles.skelBtn} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (gradebook.isError || !gradebook.data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your gradebook. Check your connection and try again.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gradebook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {gradebook.data.classes.length === 1
            ? "1 subject"
            : `${gradebook.data.classes.length} subjects`}{" "}
          for this term — open a workspace to encode scores.
        </p>
      </div>
      {gradebook.isFetching ? (
        <p className={styles.syncNote} role="status" aria-live="polite">
          Updating assessments…
        </p>
      ) : null}
      <GradebookCards
        classes={gradebook.data.classes}
        assessments={gradebook.data.assessments}
        standings={gradebook.data.standings}
      />
    </section>
  );
}
