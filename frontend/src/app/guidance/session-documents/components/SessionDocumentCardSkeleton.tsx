"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for a guidance session-document card. Mirrors the real
 * SessionDocumentKanbanCard shell so the grid settles without shifting.
 */
export function SessionDocumentCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-28 max-w-full rounded-md" />
          <Skeleton className="h-5 w-20 max-w-full rounded-md" />
        </span>
        <span className="flex w-full items-center justify-between gap-3">
          <Skeleton className="h-24 min-w-0 flex-1 rounded-lg" />
          <Skeleton className="size-24 shrink-0 rounded-full" />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-16 max-w-full rounded-md" />
          <Skeleton className="h-5 w-20 max-w-full rounded-md" />
          <Skeleton className="h-5 w-24 max-w-full rounded-md" />
        </span>
        <span className="mt-auto flex min-w-0 items-center justify-end gap-1.5 pt-0.5">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </span>
      </div>
    </article>
  );
}
