"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./NurseReferralsSkeleton.module.css";

/* Loading state that mirrors the referrals display: sticky toolbar,
   two-column entries (rail blocks incl. student card + report body),
   pager, and the action-menu sidebar — so nothing jumps when the
   fetch lands. Locked type pages (ADM/Clinic) hide the type filter,
   so `lockType` drops the phantom pill. */
export function NurseReferralsSkeleton({
  lockType = false,
  entries = 5,
  sideRows = 5,
}: {
  lockType?: boolean;
  entries?: number;
  sideRows?: number;
}) {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading your cases">
      <div className={styles.layout}>
        <div className={styles.feed}>
          <div className={styles.toolbar}>
            <Skeleton className={styles.title} />
            <div className={styles.toolbarRight}>
              <Skeleton className={styles.search} />
              {lockType ? null : <Skeleton className={styles.pill} />}
            </div>
          </div>
          <div className={styles.timeline}>
            {Array.from({ length: entries }).map((_, i) => (
              <div
                key={i}
                className={`${styles.entry}${i % 2 === 1 ? ` ${styles.entryAlt}` : ""}`}
              >
                <span className={styles.dot} aria-hidden="true" />
                <div className={styles.rail}>
                  <Skeleton className={styles.date} />
                  <div className={styles.badges}>
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </div>
                  <Skeleton className={styles.line} aria-hidden="true" />
                  <Skeleton className={styles.lineShort} aria-hidden="true" />
                  <Skeleton className={styles.latestAction} aria-hidden="true" />
                  <div className={styles.studentCard}>
                    <Skeleton className={styles.caption} aria-hidden="true" />
                    <Skeleton className={styles.avatar} />
                    <div className={styles.studentText}>
                      <Skeleton className={styles.line} aria-hidden="true" />
                      <Skeleton className={styles.lineShort} aria-hidden="true" />
                      <Skeleton className={styles.lineShort} aria-hidden="true" />
                    </div>
                  </div>
                </div>
                <div className={styles.body}>
                  <Skeleton className={styles.reason} />
                  <Skeleton className={styles.block} />
                  <Skeleton className={styles.sessions} />
                  <div className={styles.actions}>
                    <Skeleton />
                    <Skeleton />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.pager} aria-hidden="true">
            <Skeleton className={styles.range} />
            <div className={styles.pagerButtons}>
              <Skeleton className={styles.pagerBtn} />
              <Skeleton className={styles.pageLabel} />
              <Skeleton className={styles.pagerBtn} />
            </div>
          </div>
        </div>
        <div className={styles.side} aria-hidden="true">
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
