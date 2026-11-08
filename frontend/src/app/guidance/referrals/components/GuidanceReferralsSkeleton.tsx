"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import styles from "./GuidanceReferralsSkeleton.module.css";
import tableStyles from "./guidance-referrals-table.module.css";

export function GuidanceReferralsSkeleton({
  lockType = false,
}: {
  lockType?: boolean;
}) {
  /* The locked ADM / Counseling desks are kanban boards: mirror the real
     board (action tabs + search, 4×4 folder-card grid, pager), same as the
     nurse ADM skeleton. */
  if (lockType) return <GuidanceBoardSkeleton />;

  const sideGroups: { label: string; rows: number }[] = [
    { label: "ADM actions", rows: 5 },
    { label: "Counseling actions", rows: 4 },
  ];
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading your cases">
      <div className={styles.feed}>

        {!lockType ? (
          <div className={`${styles.toolbar} ${styles.toolbarSticky}`}>
            <Skeleton className={styles.title} />
            <div className={styles.toolbarRight}>
              <Skeleton className={styles.search} />
              <Skeleton className={styles.filterBtn} />
            </div>
          </div>
        ) : null}
        <div className={styles.timeline}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.entry}>
              <div className={`${styles.rail} ${styles.railSticky}`}>
                <Skeleton className={styles.date} />
                <div className={styles.badges}>
                  <Skeleton />
                  <Skeleton />

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

/* Mirrors the real guidance kanban board: action-tab pills + search row,
   4×4 folder cards (the page size), then the shared pager. The caller wraps
   this in the referrals page <section>, so no extra page padding here. */
function GuidanceBoardSkeleton() {
  return (
    <div
      className={tableStyles.layout}
      aria-busy="true"
      aria-label="Loading your cases"
    >
      <div className={`${tableStyles.feed} ${tableStyles.feedWide}`}>
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          aria-hidden="true"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {[72, 96, 84, 92, 74, 78, 84].map((width, index) => (
              <Skeleton
                key={index}
                className="h-7 rounded-full"
                style={{ width }}
              />
            ))}
          </div>
          <Skeleton className="h-8 w-40 max-w-full shrink-0 rounded-[16px]" />
        </div>
        <div className={tableStyles.kanbanGrid} aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <GuidanceCaseCardSkeleton key={i} />
          ))}
        </div>
        <ZentraPaginationSkeleton />
      </div>
    </div>
  );
}

/* Same shell as the real GuidanceCaseKanbanCard: muted outer card with a
   bordered header (category + status pill), then the inner white card holding
   the identity row, status line, metadata pills and action row. */
function GuidanceCaseCardSkeleton() {
  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
      aria-hidden="true"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </span>
          </span>
        </span>
        <Skeleton className="h-3 w-full" />
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="size-5 rounded-md" />
        </span>
        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      </div>
    </article>
  );
}
