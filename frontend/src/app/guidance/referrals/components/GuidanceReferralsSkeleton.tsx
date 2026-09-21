"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./GuidanceReferralsSkeleton.module.css";

/* Loading state that mirrors the referrals display: sticky toolbar
   (title + search + track filter), two-column entries (rail with date,
   badges, status help, sent/observed-by lines, latest-action block,
   student card + report body with reason, observed block, folder,
   callout, session plan, variable actions), pager, and the grouped
   action-menu sidebar — so nothing jumps when the fetch lands. */
export function GuidanceReferralsSkeleton({ lockType = false }: { lockType?: boolean }) {
  const sideGroups: { label: string; rows: number }[] = lockType
    ? [{ label: "Actions", rows: 4 }]
    : [
        { label: "ADM actions", rows: 5 },
        { label: "Counseling actions", rows: 4 },
      ];
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading your cases">
      <div className={styles.feed}>
        <div className={`${styles.toolbar} ${styles.toolbarSticky}`}>
          <Skeleton className={styles.title} />
          <div className={styles.toolbarRight}>
            <Skeleton className={styles.search} />
            {!lockType ? <Skeleton className={styles.filterBtn} /> : null}
          </div>
        </div>
        <div className={styles.timeline}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${styles.entry}${i % 2 === 1 ? ` ${styles.entryAlt}` : ""}`}
            >
              <span className={styles.dot} aria-hidden="true" />
              <div className={`${styles.rail} ${styles.railSticky}`}>
                <Skeleton className={styles.date} />
                <div className={styles.badges}>
                  <Skeleton />
                  <Skeleton />
                  {/* Third badge wraps on most rows; fourth only for priority. */}
                  <Skeleton className={i === 2 ? styles.badgeHidden : undefined} />
                </div>
                <Skeleton className={styles.statusHelp} />
                <Skeleton className={styles.meta} />
                <Skeleton className={styles.metaShort} />
                <div className={styles.latestAction}>
                  <Skeleton className={styles.latestLabel} />
                  <Skeleton className={styles.line} />
                  <Skeleton className={styles.metaShort} />
                </div>
                <div className={styles.studentCard}>
                  <Skeleton className={styles.studentCaption} />
                  <div className={styles.studentRow}>
                    <Skeleton className={styles.avatar} />
                    <div className={styles.studentText}>
                      <Skeleton className={styles.line} />
                      <Skeleton className={styles.lineShort} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.body}>
                <Skeleton className={styles.reason} />
                <div className={styles.observed}>
                  <Skeleton className={styles.observedLabel} />
                  <Skeleton className={styles.line} />
                  <Skeleton className={styles.lineShort} />
                  <Skeleton className={styles.folder} />
                </div>
                <Skeleton className={styles.callout} />
                <div className={styles.sessions}>
                  <div className={styles.sessionsHead}>
                    <Skeleton className={styles.sessionsTitle} />
                    <Skeleton className={styles.sessionsPill} />
                  </div>
                  <Skeleton className={styles.line} />
                  <Skeleton className={styles.metaShort} />
                </div>
                <div className={styles.actions}>
                  {i === 0 ? (
                    <>
                      <Skeleton className={styles.actionWide} />
                      <Skeleton className={styles.actionNarrow} />
                    </>
                  ) : (
                    <Skeleton className={styles.actionWide} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.pager} aria-hidden="true">
          <Skeleton className={styles.pagerRange} />
          <div className={styles.pagerButtons}>
            <Skeleton className={styles.pagerBtn} />
            <Skeleton className={styles.pagerLabel} />
            <Skeleton className={styles.pagerBtn} />
          </div>
        </div>
      </div>
      <div className={styles.side} aria-hidden="true">
        {sideGroups.map((group) => (
          <div key={group.label} className={styles.sideGroup}>
            <Skeleton className={styles.sideGroupLabel} />
            {Array.from({ length: group.rows }).map((_, r) => (
              <div key={r} className={styles.sideRowWrap}>
                <Skeleton className={styles.sideRowLabel} />
                <Skeleton className={styles.sideCount} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
