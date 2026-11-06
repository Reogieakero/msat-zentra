"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE } from "@/components/shared/pagination";
import styles from "./anecdotal-repo.module.css";
import repoStyles from "./anecdotal-repo-folders.module.css";

/**
 * One filed-record folder card placeholder — same shell as
 * `AnecdotalRecordKanbanCard`: muted outer card, category header row, white
 * body with the student (mascot + name + LRN pills) above the folder graphic.
 */
function RecordCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5">
      <div className="-mx-2.5 flex items-center gap-1.5 border-b border-border px-3.5 pb-2">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 dark:bg-card">
        <div className="flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <Skeleton className="h-5 w-32 max-w-full rounded-md" />
            <Skeleton className="h-5 w-24 max-w-full rounded-md" />
          </div>
        </div>
        <div className="flex w-full justify-center">
          <Skeleton className="aspect-[50/40] w-full max-w-[220px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Legend / chat card placeholder for the mobile stack below the grid. */
function SideCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * Filed-records loading state — mirrors `/teacher/anecdotal`: the folder panel
 * (search field top-right, 15-card grid, pagination footer) plus the icon rail
 * and the stacked chat/legend cards on small screens.
 */
export function AnecdotalRepoFoldersSkeleton() {
  return (
    <section className={styles.page} aria-busy="true" aria-label="Loading filed records">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${styles.main} flex min-w-0 flex-col`}>
          <div className={`${repoStyles.panel} flex flex-1 flex-col`} aria-hidden>
            <div className="flex w-full items-center justify-end gap-2 pt-1">
              <Skeleton className="h-9 w-full max-w-56 shrink-0 rounded-full" />
            </div>
            <div className={repoStyles.content}>
              <div className={repoStyles.scrollArea}>
                <div className={repoStyles.folderGrid}>
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <RecordCardSkeleton key={i} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="hidden min-w-0 flex-col items-end gap-2 lg:sticky lg:top-16 lg:flex"
          aria-hidden
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden" aria-hidden>
        <SideCardSkeleton rows={3} />
        <SideCardSkeleton rows={2} />
      </div>
    </section>
  );
}
