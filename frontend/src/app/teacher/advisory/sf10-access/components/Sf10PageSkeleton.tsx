"use client";

import { Skeleton } from "@/components/ui/skeleton";
import repoStyles from "./sf10-repo.module.css";
import folderStyles from "./sf10-repo-folders.module.css";

/**
 * One folder tile placeholder. Mirrors the loaded card markup exactly (outer
 * tinted frame, status pill strip, inner white slip with avatar/name/LRN and
 * the 120×100 folder illustration footprint) so nothing jumps when data lands.
 */
export function Sf10FolderCardSkeleton() {
  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left dark:bg-muted/20"
      aria-hidden
    >
      <span className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
        <Skeleton className="h-5 w-28 rounded-full" />
      </span>
      <span className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <span className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-5 w-3/4 rounded-full" />
            <Skeleton className="h-5 w-1/2 rounded-full" />
          </span>
        </span>
        <span className="flex w-full justify-center">
          <Skeleton className="h-[100px] w-[120px] rounded-lg" />
        </span>
      </span>
    </div>
  );
}

/**
 * Page-level loading state. Reuses the real page/sidebar CSS modules and the
 * same grid + header structure as the loaded desk (title/desc columns, centred
 * source tabs, right-aligned search, folder grid, right icon rail, mobile
 * cards) so the skeleton is a pixel match of the page it replaces.
 */
export function Sf10PageSkeleton() {
  return (
    <section
      className={repoStyles.page}
      aria-busy="true"
      aria-label="Loading SF10 access"
    >
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${repoStyles.main} flex min-w-0 flex-col`}>
          <div className={`${folderStyles.panel} flex flex-1 flex-col`}>
            <div className={folderStyles.header}>
              <div className={folderStyles.headerText}>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-64 max-w-full" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-self-center">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-6 w-28 rounded-md" />
              </div>
              <div
                className={`${folderStyles.headerActions} sm:justify-self-end`}
              >
                <Skeleton
                  className={`${folderStyles.search} h-8 rounded-[16px]`}
                />
              </div>
            </div>
            <div className={folderStyles.content}>
              <div className={folderStyles.scrollArea}>
                <div className={folderStyles.folderGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Sf10FolderCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside
          className="hidden self-start lg:sticky lg:top-16 lg:block"
          aria-hidden
        >
          <div className="flex flex-row justify-end gap-2 lg:flex-col lg:items-end">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </aside>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden" aria-hidden>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </section>
  );
}
