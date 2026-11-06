"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** One stat tile in the identity strip — label line + value line. */
function StatTileSkeleton() {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col items-center justify-between gap-1 rounded-md border bg-card px-3 py-2">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-4 w-20 max-w-full" />
    </div>
  );
}

function ModulesTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {Array.from({ length: 7 }).map((_, i) => (
              <th key={i} scope="col" className="border-b px-2 py-1.5 font-semibold">
                <Skeleton className="h-2.5 w-14" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, row) => (
            <tr key={row} className="align-top">
              <td className="max-w-[16rem] border-b px-2 py-2">
                <Skeleton className="h-3.5 w-36 max-w-full" />
                <Skeleton className="mt-1 h-4 w-16 rounded-md" />
              </td>
              {Array.from({ length: 5 }).map((__, col) => (
                <td key={col} className="whitespace-nowrap border-b px-2 py-2">
                  <Skeleton className="h-3.5 w-16" />
                </td>
              ))}
              <td className="border-b px-2 py-2">
                <div className="flex justify-end">
                  <Skeleton className="h-6 w-14 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Loading module progress">
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background px-3 py-2"
          >
            <Skeleton className="h-2.5 w-24 max-w-full" />
            <Skeleton className="mt-1.5 h-4 w-12" />
            <Skeleton className="mt-1 h-2.5 w-20 max-w-full" />
          </div>
        ))}
      </div>
      <div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>
    </section>
  );
}

function ReportSkeleton() {
  return (
    <section aria-label="Loading monitoring report" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background px-3 py-2"
          >
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-1.5 h-3.5 w-20 max-w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ModuleStatusSkeleton() {
  return (
    <section aria-label="Loading module status" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3.5 w-24" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-md border bg-background p-3">
        <div className="mx-auto flex h-[148px] w-full max-w-[180px] items-center justify-center">
          <Skeleton className="size-[148px] rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-20" />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 border-t pt-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </div>
    </section>
  );
}

/**
 * ADM monitoring loading state — mirrors the loaded case desk in order:
 * back link + identity strip (learner card + six stat tiles), then the band
 * shared by module progress, the monitoring report and module status, then
 * the full-width modules table.
 */
export function MonitoringSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-busy="true"
      aria-label="Loading ADM monitoring"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-32" />

        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-4 w-28 max-w-full" />
              <Skeleton className="h-2.5 w-24 max-w-full" />
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <ProgressSkeleton />
        <ReportSkeleton />
        <ModuleStatusSkeleton />
      </div>

      <section
        className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4"
        aria-label="Loading modules"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-md" />
            ))}
          </div>
        </div>
        <ModulesTableSkeleton />
      </section>
    </div>
  );
}
