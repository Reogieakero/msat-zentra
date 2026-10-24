"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./adviser-access-tables.module.css";

/* Shared skeletons for the adviser-access desks (registrar + record-keeper).
   They reuse the real board CSS module so column widths, gaps and the
   header/column-head chrome can't drift from the loaded Request Board. */

const COLUMN_TITLES = [
  "Pending checking",
  "Awaiting decision",
  "Approved",
  "Reported missing",
] as const;

/* The four number-first KPI columns at the top of the page. */
export function AdviserAccessSummarySkeleton({
  count = 4,
  className,
}: {
  count?: number;
  /** Page-scoped class (e.g. the entrance-animation `summaryGrid`). */
  className?: string;
}) {
  return (
    <section
      aria-hidden="true"
      className={`${className ? `${className} ` : ""}grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-4`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
        >
          <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 rounded-lg border bg-white p-4 shadow-sm dark:bg-card">
            <span className="flex min-w-0 items-center justify-between gap-2">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-9 w-12 rounded-md" />
            </span>
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </section>
  );
}

/* The Request Board: header line + four state columns of student cards. */
export function AdviserAccessBoardSkeleton({ cardsPerColumn = 4 }: { cardsPerColumn?: number }) {
  return (
    <section aria-hidden="true" className="flex min-w-0 flex-col gap-4">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-1 h-5 w-72 max-w-full" />
        </div>
      </div>
      <div className={styles.kanbanGrid}>
        {COLUMN_TITLES.map((title) => (
          <div
            key={title}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          >
            <div className="-mx-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-border px-3.5 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-6" />
            </div>
            <ul className="flex min-w-0 flex-col gap-2">
              {Array.from({ length: cardsPerColumn }).map((_, i) => (
                <li
                  key={i}
                  className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Skeleton className="h-4 w-32 max-w-full" />
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
