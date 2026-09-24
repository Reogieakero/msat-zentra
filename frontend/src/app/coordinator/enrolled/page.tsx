"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CaseHistoryDialog } from "../components/CaseHistoryDialog";
import { useCoordinatorEnrolled } from "./components/use-coordinator-enrolled";
import { CoordinatorEnrolledFilters } from "./components/coordinator-enrolled-filters";
import { CoordinatorEnrolledTable } from "./components/coordinator-enrolled-table";
import { CoordinatorEnrolledPager } from "./components/coordinator-enrolled-pager";
import { CoordinatorEnrolledCompleteDialog } from "./components/coordinator-enrolled-complete-dialog";
import { CoordinatorEnrolledSkeleton } from "./components/coordinator-enrolled-skeleton";
import styles from "./components/coordinator-enrolled.module.css";

function CoordinatorEnrolledPageInner() {
  const r = useCoordinatorEnrolled();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const openedFor = React.useRef<string | null>(null);
  const { rows, enrolledPending, historyTarget, setHistoryTarget } = r;

  // Deep-link support (?highlight=<rowId>): open history for the matching
  // enrolled row once its page loads. No-ops when the id is not on the
  // current page so filters/pagination stay untouched.
  React.useEffect(() => {
    if (!highlight || openedFor.current === highlight) return;
    if (enrolledPending || historyTarget) return;
    const match = rows.find((row) => row.id === highlight);
    if (match) {
      openedFor.current = highlight;
      setHistoryTarget({
        title: match.student,
        profileId: match.id.startsWith("referral:")
          ? undefined
          : match.id,
        referralId: match.id.startsWith("referral:")
          ? match.id.replace(/^referral:/, "")
          : undefined,
      });
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
        stageTab={r.stageTab}
        onStageTabChange={r.setStageTab}
        hasActiveFilters={r.hasActiveFilters}
        onClear={r.clearFilters}
      />
      <CoordinatorEnrolledTable
        rows={r.rows}
        stageTab={r.stageTab}
        isPending={r.enrolledPending}
        isError={r.enrolledError}
        isRefetching={r.enrolledRefetching}
        hasActiveFilters={r.hasActiveFilters}
        completingId={r.completingId}
        onRetry={r.refetchEnrolled}
        onOpenCase={(row) => {
          window.open(
            `/coordinator/referrals/${encodeURIComponent(row.id)}`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
        onHistory={r.setHistoryTarget}
        onComplete={r.setCompleteTarget}
      />
      {!r.enrolledPending && !r.enrolledError && r.rows.length > 0 && (
        <CoordinatorEnrolledPager
          total={r.total}
          start={r.start}
          end={r.end}
          page={r.safePage}
          totalPages={r.totalPages}
          isBackground={r.enrolledBackground}
          onPageChange={(next) => r.setPage(next)}
        />
      )}

      {/* Case history */}
      <CaseHistoryDialog
        target={r.historyTarget}
        onClose={() => r.setHistoryTarget(null)}
      />

      {/* Mark monitoring case as completed */}
      <CoordinatorEnrolledCompleteDialog
        target={r.completeTarget}
        pending={r.stagePending}
        onClose={() => r.setCompleteTarget(null)}
        onConfirm={r.confirmComplete}
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
          <CoordinatorEnrolledSkeleton rows={10} />
        </section>
      }
    >
      <CoordinatorEnrolledPageInner />
    </React.Suspense>
  );
}
