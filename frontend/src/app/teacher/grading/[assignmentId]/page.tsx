"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClassDetail } from "../components/grading-data";
import { ClassWorkspace } from "./components/ClassWorkspace";
import styles from "./components/ClassWorkspace.module.css";

const SKELETON_ROWS = 6;

export default function ClassWorkspacePage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["teacher-grading-class", assignmentId],
    queryFn: () => fetchClassDetail(assignmentId),
    // Keep the previous class on screen while the next one loads so
    // switching assessments never flashes a full-page skeleton.
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher-grading-class", assignmentId] });

  // Initial load only: mirrors the workspace (back link, header, sidebar,
  // score table with Student/LRN/Score/% columns, footer). Background
  // refetches keep existing data visible via placeholderData above.
  if (detailQuery.isPending || !detailQuery.data) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading class workspace">
        <div className={styles.topRow} aria-hidden="true">
          <Skeleton className={styles.skelBack} />
          <div className={styles.skelHead}>
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelSub} />
          </div>
        </div>
        <div className={styles.layout} aria-hidden="true">
          <aside className={styles.skelSide}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={styles.skelSideRow} />
            ))}
          </aside>
          <div className={styles.skelMain}>
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelSub} />
            <div className={styles.skelTableHead}>
              <Skeleton className={styles.skelCell} />
              <Skeleton className={styles.skelCell} />
              <Skeleton className={styles.skelCell} />
              <Skeleton className={styles.skelCell} />
            </div>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <div key={i} className={styles.skelRow}>
                <Skeleton className={styles.skelCell} />
                <Skeleton className={styles.skelCell} />
                <Skeleton className={styles.skelCell} />
                <Skeleton className={styles.skelCell} />
              </div>
            ))}
            <div className={styles.skelFoot}>
              <Skeleton className={styles.skelSub} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (detailQuery.isError) {
    return (
      <section className={styles.page}>
        <Link href="/teacher/grading" className={styles.back}>
          <ArrowLeft className={styles.backIcon} />
          Back to Gradebook
        </Link>
        <p>Class not found or you have no access to it.</p>
      </section>
    );
  }

  // No remount key here on purpose: the encoder keeps its category,
  // assessment, and draft state across refetches, so saved scores stay on
  // screen and remain editable. Fresh server data flows in via props
  // (finals table, assessment lists) while drafts are preserved.
  return (
    <>
      {detailQuery.isFetching ? (
        <p className={styles.skelSync} role="status" aria-live="polite">
          Updating scores…
        </p>
      ) : null}
      <ClassWorkspace detail={detailQuery.data} onMutated={refresh} />
    </>
  );
}
