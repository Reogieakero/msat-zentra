"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CaseHistoryDialog, historyTargetFor } from "../components/CaseHistoryDialog";
import { useCoordinatorEnrolled } from "./components/use-coordinator-enrolled";
import {
  CoordinatorEnrolledBoard,
  CoordinatorEnrolledBoardSkeleton,
} from "./components/coordinator-enrolled-board";
import { CoordinatorEnrolledCompleteConfirm } from "./components/coordinator-enrolled-complete-confirm";
import { Pagination } from "@/components/shared/pagination";
import styles from "./components/coordinator-enrolled.module.css";

function CoordinatorEnrolledPageInner() {
  const r = useCoordinatorEnrolled();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const openedFor = React.useRef<string | null>(null);
  const { rows, enrolledPending, historyTarget, setHistoryTarget } = r;

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
    <section
      className={
        !r.enrolledPending && !r.enrolledError && r.rows.length === 0 && !r.hasActiveFilters
          ? `${styles.page} ${styles.pageEmpty}`
          : styles.page
      }
      aria-label="Enrolled students"
      aria-busy={r.enrolledPending || undefined}
    >
      {!r.enrolledPending && !r.enrolledError && r.rows.length === 0 && !r.hasActiveFilters ? null : (
        <CoordinatorEnrolledBoard
          rows={r.rows}
          isPending={r.enrolledPending}
          isError={r.enrolledError}
          isRefetching={r.enrolledRefetching}
          hasActiveFilters={r.hasActiveFilters}
          completingId={r.completingId}
          query={r.query}
          onQueryChange={r.setQuery}
          onRetry={r.refetchEnrolled}
          onHistory={r.setHistoryTarget}
          onComplete={r.setCompleteTarget}
        />
      )}

      {!r.enrolledPending && !r.enrolledError && r.total > 0 ? (
        <Pagination
          currentPage={r.safePage}
          totalItems={r.total}
          onPageChange={(p) => r.setPage(p)}
        />
      ) : null}

      <CaseHistoryDialog
        target={r.historyTarget}
        onClose={() => r.setHistoryTarget(null)}
      />

      {r.completeTarget ? (
        <CoordinatorEnrolledCompleteConfirm
          row={r.completeTarget}
          pending={r.stagePending}
          onConfirm={r.confirmComplete}
          onClose={() => {
            if (!r.stagePending) r.setCompleteTarget(null);
          }}
        />
      ) : null}
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
          <CoordinatorEnrolledBoardSkeleton />
        </section>
      }
    >
      <CoordinatorEnrolledPageInner />
    </React.Suspense>
  );
}
