"use client";

import { Skeleton } from "@/components/ui/skeleton";
import refStyles from "../../referrals/components/referrals.module.css";

const COLUMNS = 6;

/**
 * One ADM case column placeholder — same shell as the real board: tinted
 * outer article with the prepared-date header + stage pill, then the centered
 * student card (mascot, name, LRN pill, Monitor button).
 */
function AdmCaseColumnSkeleton() {
  return (
    <li className="flex min-w-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border p-2.5">
        <div className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
          <Skeleton className="size-2 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-5 w-20 rounded-full" />
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2 rounded-lg border border-border bg-white p-3 dark:bg-card">
          <Skeleton className="size-24 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32 max-w-full" />
          <Skeleton className="h-5 w-24 max-w-full rounded-md" />
          <div className="flex w-full justify-end">
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * ADM cases loading state — mirrors the loaded desk: "ADM Cases" header with
 * the filter field, one column per case (date + stage header, student card),
 * the pagination footer, the icon rail, and the starter strip on small screens.
 */
export function AdmCasesSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading ADM cases">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1.5 h-3.5 w-56" />
            </div>
            <Skeleton className="h-9 w-40 shrink-0 rounded-[16px]" />
          </div>

          <ul className={`relative ${refStyles.recordGrid}`}>
            {Array.from({ length: COLUMNS }).map((_, i) => (
              <AdmCaseColumnSkeleton key={i} />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>

        <div
          className="hidden min-w-0 flex-col items-end gap-2 self-start lg:sticky lg:top-16 lg:flex"
          aria-hidden
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-border pt-4 lg:hidden" aria-hidden>
        <div className={refStyles.stripGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5"
            >
              <div className="flex items-center gap-1.5 border-b border-border pb-2">
                <Skeleton className="size-3.5 shrink-0 rounded-sm" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
