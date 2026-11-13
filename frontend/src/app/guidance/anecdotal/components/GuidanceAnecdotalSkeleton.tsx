"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import filtersStyles from "./guidance-anecdotal-filters.module.css";
import folderStyles from "./guidance-anecdotal-folders.module.css";
import pageStyles from "./guidance-anecdotal.module.css";

/**
 * Loading shell for /guidance/anecdotal. It reuses the live folder panel's own
 * layout classes (panel header with title/help/description, centred type tabs,
 * search, the 5/4/3/2/1 folder grid and the shared pager) plus the 2.75rem icon
 * rail and the mobile-only summary cards, so the board does not move when the
 * records land.
 */

const CARD_COUNT = 10;
/** Same labels as the live tabs: All types · ADM consultation · Counseling. */
const TYPE_TAB_WIDTHS = ["4.4rem", "7.6rem", "5.4rem"];

/** One placeholder folder card on the real AnecdotalRecordKanbanCard shell. */
function FolderCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20">
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-3.5 rounded" />
          <Skeleton className="h-[0.8125rem] w-24" />
        </span>
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <div className="flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <Skeleton className="h-[0.875rem] w-28 max-w-full" />
            <span className="flex gap-1">
              <Skeleton className="h-[1.125rem] w-20 rounded-md" />
              <Skeleton className="h-[1.125rem] w-16 rounded-md" />
            </span>
          </span>
        </div>
        <span className="flex w-full justify-center">
          <Skeleton className="h-[100px] w-[120px] rounded-md" />
        </span>
      </div>
    </div>
  );
}

/** Mobile-only summary cards that sit under the panel below `lg`. */
function MobileCardsSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:hidden" aria-hidden="true">
      <div className={assign.card}>
        <div className="relative">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
        <ol className="relative flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32 max-w-full" />
                <Skeleton className="mt-1 h-[1.125rem] w-20 rounded-md" />
              </span>
              <Skeleton className="size-5 shrink-0 rounded-full" />
            </li>
          ))}
        </ol>
      </div>

      <div className={assign.card}>
        <div className="relative flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-40" />
          </div>
        </div>
        <div className="relative flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex items-center gap-2">
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GuidanceAnecdotalSkeleton() {
  return (
    <section
      className={pageStyles.page}
      aria-busy="true"
      aria-label="Loading referred records"
    >
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${pageStyles.main} flex min-w-0 flex-col`}>
          <div className={folderStyles.panel}>
            <div className={folderStyles.header}>
              <div className={folderStyles.headerText}>
                <div className={folderStyles.titleRow}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                </div>
                <Skeleton className="mt-1.5 h-3 w-[22rem] max-w-full" />
              </div>

              <div className={folderStyles.headerCenter} aria-hidden="true">
                <div className="flex flex-wrap items-center gap-1">
                  {TYPE_TAB_WIDTHS.map((width) => (
                    <Skeleton key={width} className="h-5 rounded-md" style={{ width }} />
                  ))}
                </div>
              </div>

              <div className={folderStyles.headerActions}>
                <div className={filtersStyles.searchWrap}>
                  <Skeleton className={filtersStyles.search} />
                </div>
              </div>
            </div>

            <div className={folderStyles.content}>
              <div className={folderStyles.scrollArea}>
                <div className={folderStyles.studentGrid} aria-hidden="true">
                  {Array.from({ length: CARD_COUNT }, (_, i) => (
                    <FolderCardSkeleton key={i} />
                  ))}
                </div>
              </div>
              <ZentraPaginationSkeleton />
            </div>
          </div>
        </div>

        <aside className="hidden self-start lg:sticky lg:top-16 lg:block">
          <div
            className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end"
            aria-hidden="true"
          >
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
        </aside>
      </div>

      <MobileCardsSkeleton />
    </section>
  );
}
