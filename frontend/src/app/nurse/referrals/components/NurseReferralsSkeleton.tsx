"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import tableStyles from "./NurseAlertsTable.module.css";

/* Mirrors the real NurseAlertsTable kanban layout (action tabs + search row,
   a 4-up folder-card grid, then the shared pager). The caller already wraps
   this in the referrals page <section>, so no extra page padding here. */
export function NurseReferralsSkeleton({
  entries = 16,
  paginate = true,
}: {
  entries?: number;
  /** @deprecated kanban layout has no side rail; kept for call-site compat. */
  sideRows?: number;
  paginate?: boolean;
}) {
  return (
    <div className={tableStyles.layout} aria-busy="true" aria-label="Loading your cases">
      <div className={`${tableStyles.feed} ${tableStyles.feedWide}`}>
        <div className="flex flex-wrap items-center justify-between gap-2" aria-hidden="true">
          <Skeleton className="h-6 w-64 max-w-full rounded-md" />
          <Skeleton className="h-8 w-56 max-w-full shrink-0 rounded-[16px]" />
        </div>
        <div className={tableStyles.kanbanGrid} aria-hidden="true">
          {Array.from({ length: entries }).map((_, i) => (
            <NurseCaseCardSkeleton key={i} />
          ))}
        </div>
        {paginate ? <ZentraPaginationSkeleton /> : null}
      </div>
    </div>
  );
}

/* Same shell as the real NurseCaseKanbanCard article: outer muted card with
   a bordered header, then the inner white card holding the identity row,
   folder block and pill row. */
function NurseCaseCardSkeleton() {
  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
      aria-hidden="true"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </span>
        <Skeleton className="h-20 w-full rounded-lg" />
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-28 rounded-md" />
        </span>
      </div>
    </article>
  );
}
