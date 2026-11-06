"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./coordinator-referrals-skeleton.module.css";

function BoardSkeleton({ rows }: { rows: number }) {
  return (
    <div className={styles.boardShell} aria-hidden="true">
      <div className={styles.headRow}>
        <div className={styles.headText}>
          <Skeleton className={styles.title} />
          <Skeleton className={styles.desc} />
        </div>
        <div className={styles.headActions}>
          <Skeleton className={styles.search} />
          <Skeleton className={styles.filterBtn} />
        </div>
      </div>
      <div className={styles.grid}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.skelCard}>
            <div className={styles.skelHead}>
              <Skeleton className={styles.skelAvatar} />
              <div className={styles.skelId}>
                <Skeleton className={styles.line} />
                <Skeleton className={styles.lineSm} />
              </div>
            </div>
            <div className={styles.skelPills}>
              <Skeleton className={styles.skelPill} />
              <Skeleton className={styles.skelPillSm} />
            </div>
            <Skeleton className={styles.skelBlock} />
          </div>
        ))}
      </div>
      <Skeleton className={styles.interpretation} />
    </div>
  );
}

export function CoordinatorReferralsSkeleton({
  rows = 9,
  layout = "full",
}: {
  rows?: number;
  layout?: "full" | "board";
}) {
  if (layout === "board") {
    return (
      <div aria-busy="true" aria-label="Loading referrals">
        <BoardSkeleton rows={rows} />
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Loading referrals">
      <div className={styles.body}>
        <div className={styles.mainCol}>
          <BoardSkeleton rows={rows} />
          <div className={styles.pager}>
            <Skeleton className={styles.range} />
            <div className={styles.pagerButtons}>
              <Skeleton className={styles.pageBtn} />
              <Skeleton className={styles.pageLabel} />
              <Skeleton className={styles.pageBtn} />
            </div>
          </div>
        </div>
        <div className={styles.railIcons} aria-hidden="true">
          <Skeleton className={styles.railIcon} />
          <Skeleton className={styles.railIcon} />
        </div>
      </div>
    </div>
  );
}
