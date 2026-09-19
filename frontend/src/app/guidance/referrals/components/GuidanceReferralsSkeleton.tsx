"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./GuidanceReferralsSkeleton.module.css";

/* Loading state that mirrors the referrals display: sticky-style toolbar,
   two-column entries (rail blocks incl. student card + report body), and
   the action-menu sidebar — so nothing jumps when the fetch lands. */
export function GuidanceReferralsSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading your cases">
      <div className={styles.feed}>
        <div className={styles.toolbar}>
          <Skeleton className={styles.title} />
          <div className={styles.toolbarRight}>
            <Skeleton className={styles.search} />
          </div>
        </div>
        <div className={styles.timeline}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${styles.entry}${i % 2 === 1 ? ` ${styles.entryAlt}` : ""}`}
            >
              <div className={styles.rail}>
                <Skeleton className={styles.date} />
                <div className={styles.badges}>
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </div>
                <Skeleton className={styles.line} />
                <Skeleton className={styles.lineShort} />
                <div className={styles.studentCard}>
                  <Skeleton className={styles.avatar} />
                  <Skeleton className={styles.line} />
                  <Skeleton className={styles.lineShort} />
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
      </div>
      <div className={styles.side} aria-hidden="true">
        <Skeleton className={styles.sideRow} />
        <Skeleton className={styles.sideRow} />
        <Skeleton className={styles.sideRow} />
        <Skeleton className={styles.sideRow} />
      </div>
    </div>
  );
}
