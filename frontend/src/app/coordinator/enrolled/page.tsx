"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CaseHistoryDialog, historyTargetFor } from "../components/CaseHistoryDialog";
import { useCoordinatorEnrolled } from "./components/use-coordinator-enrolled";
import { CoordinatorEnrolledFilters } from "./components/coordinator-enrolled-filters";
import { CoordinatorEnrolledGrid } from "./components/coordinator-enrolled-grid";
import { CoordinatorEnrolledSkeleton } from "./components/coordinator-enrolled-skeleton";
import styles from "./components/coordinator-enrolled.module.css";

function CoordinatorEnrolledPageInner() {
  const r = useCoordinatorEnrolled();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const openedFor = React.useRef<string | null>(null);
  const { rows, enrolledPending, historyTarget, setHistoryTarget } = r;

  // Deep-link support (?highlight=<rowId>): open history for the matching
  // enrolled row once it loads. No-ops when the id is not shown so
  // filters stay untouched.
  React.useEffect(() => {
    if (!highlight || openedFor.current === highlight) return;
    if (enrolledPending || historyTarget) return;
    const match = rows.find((row) => row.id === highlight);
    if (match) {
      openedFor.current = highlight;
      setHistoryTarget(historyTargetFor(match));
    }
  }, [highlight, rows, enrolledPending, historyTarget, setHistoryTarget]);

  return (
    <section className={styles.page} aria-label="Enrolled students">
      <CoordinatorEnrolledFilters
        total={r.total}
        query={r.query}
        onQueryChange={r.setQuery}
        elig={r.elig}
        onEligChange={r.setElig}
        eligMenuLabel={r.eligMenuLabel}
        hasActiveFilters={r.hasActiveFilters}
        onClear={r.clearFilters}
      />
      <CoordinatorEnrolledGrid
        rows={r.rows}
        isPending={r.enrolledPending}
        isError={r.enrolledError}
        isRefetching={r.enrolledRefetching}
        hasActiveFilters={r.hasActiveFilters}
        onRetry={r.refetchEnrolled}
        onHistory={r.setHistoryTarget}
      />

      {/* Case history */}
      <CaseHistoryDialog
        target={r.historyTarget}
        onClose={() => r.setHistoryTarget(null)}
      />
    </section>
  );
}

export default function CoordinatorEnrolledPage() {
  return (
    <React.Suspense
      fallback={
        <section
          className={styles.page}
          aria-label="Enrolled students"
          aria-busy="true"
        >
          <CoordinatorEnrolledSkeleton rows={6} />
        </section>
      }
    >
      <CoordinatorEnrolledPageInner />
    </React.Suspense>
  );
}
