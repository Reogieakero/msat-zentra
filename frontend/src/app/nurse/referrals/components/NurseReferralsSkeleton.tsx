"use client";

import { Skeleton } from "@/components/ui/skeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./NurseReferralsSkeleton.module.css";

/* Loading state that mirrors the referrals display: one section card
   per case (identity header + title + blocks + footer actions), the pager
   (paginated feeds only), and the action-menu card — so nothing jumps when
   the fetch lands. */
export function NurseReferralsSkeleton({
  entries = 5,
  sideRows = 5,
  paginate = true,
}: {
  entries?: number;
  sideRows?: number;
  paginate?: boolean;
}) {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading your cases">
      <div className={styles.layout}>
        <div className={styles.feed}>
          <div className={styles.cards}>
            {Array.from({ length: entries }).map((_, i) => (
              <div key={i} className={assign.card} aria-hidden="true">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className={`relative ${styles.cardHead}`}>
                  <div className={styles.identity}>
                    <Skeleton className={styles.avatar} />
                    <div className={styles.identityText}>
                      <Skeleton className={styles.name} />
                      <Skeleton className={styles.nameSub} />
                    </div>
                  </div>
                  <div className={styles.badges}>
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </div>
                </div>
                <div className="relative">
                  <Skeleton className={styles.reason} />
                </div>
                <div className="relative">
                  <Skeleton className={styles.block} />
                </div>
                <div className={`relative ${styles.actions}`}>
                  <Skeleton />
                  <Skeleton />
                </div>
              </div>
            ))}
          </div>
          {paginate ? (
            <div className={styles.pager} aria-hidden="true">
              <Skeleton className={styles.range} />
              <div className={styles.pagerButtons}>
                <Skeleton className={styles.pagerBtn} />
                <Skeleton className={styles.pageLabel} />
                <Skeleton className={styles.pagerBtn} />
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.side} aria-hidden="true">
          <div className={styles.sideHead}>
            <Skeleton className={styles.sideIcon} />
            <div className={styles.sideHeadText}>
              <Skeleton className={styles.sideTitle} />
              <Skeleton className={styles.sideSub} />
            </div>
          </div>
          <Skeleton className={styles.sideLabel} />
          {Array.from({ length: sideRows }).map((_, i) => (
            <Skeleton
              key={i}
              className={`${styles.sideRow}${i === sideRows - 1 ? ` ${styles.sideRowLast}` : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
