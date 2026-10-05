"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdmCaseRow } from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { CoordinatorEnrolledCard } from "./coordinator-enrolled-card";
import styles from "./coordinator-enrolled-card.module.css";

interface CoordinatorEnrolledGridProps {
  rows: AdmCaseRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  hasActiveFilters: boolean;
  skeletonRows?: number;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
}

function CardSkeleton() {
  return (
    <div className={styles.skelCard} aria-hidden="true">
      <Skeleton className={styles.skelVisual} />
      <div className={styles.skelBody}>
        <Skeleton className={styles.skelTitle} />
        <div className={styles.skelFacts}>
          <Skeleton className={styles.skelFact} />
          <Skeleton className={styles.skelFact} />
          <Skeleton className={styles.skelFact} />
        </div>
        <Skeleton className={styles.skelTrack} />
        <Skeleton className={styles.skelNote} />
        <Skeleton className={styles.skelNote} />
      </div>
      <div className={styles.skelActions}>
        <Skeleton className={styles.skelCta} />
      </div>
    </div>
  );
}

export function CoordinatorEnrolledGrid({
  rows,
  isPending,
  isError,
  isRefetching,
  hasActiveFilters,
  skeletonRows = 6,
  onRetry,
  onHistory,
}: CoordinatorEnrolledGridProps) {
  if (isPending) {
    return (
      <div
        className={styles.grid}
        aria-busy="true"
        aria-label="Loading enrolled students"
      >
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the enrolled students. Please check your
          internet connection and try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefetching}
          onClick={onRetry}
        >
          {isRefetching ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <p className={styles.emptyText}>
          {hasActiveFilters
            ? `No enrolled students match your search and filters.`
            : `No students in enrollment monitoring yet. Approved cases appear here automatically.`}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid} aria-label="Enrolled ADM students">
      {rows.map((r) => (
        <CoordinatorEnrolledCard key={r.id} row={r} onHistory={onHistory} />
      ))}
    </div>
  );
}
