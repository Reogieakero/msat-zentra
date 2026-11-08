"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import styles from "./modules-skeleton.module.css";

const MODULE_CARDS = 6;
const SUBMISSION_CARDS = 6;

/** One module tile placeholder — mirrors the loaded <article> in ModulesPanel. */
function ModuleCardSkeleton() {
  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
      aria-hidden
    >
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3.5 w-28" />
        </span>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>

      <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <div className="flex w-full justify-center">
          <Skeleton className="h-[100px] w-[120px] rounded-lg" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex shrink-0 items-center gap-1">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>
    </article>
  );
}

/** One learner submission tile — mirrors the loaded <article> in SubmissionsTable. */
function SubmissionCardSkeleton() {
  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
      aria-hidden
    >
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-[26px] shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </span>
        </span>
        <Skeleton className="h-5 w-28 shrink-0 rounded-full" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-3 w-32" />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>

      <div className="flex items-center justify-end px-0.5">
        <Skeleton className="h-6 w-32 rounded-md" />
      </div>
    </article>
  );
}

/**
 * Loading state for the adviser Modules desk. Mirrors the loaded page one-for-one:
 * the Modules panel (title + submitted pill, status filter tabs, section picker +
 * Add module, the card grid and its pager) followed by the Student submissions
 * panel (module pill, submitted pill, learner cards and its pager).
 */
export function AdvisoryModulesSkeleton() {
  return (
    <div className={`${styles.root} flex flex-col gap-10`} aria-busy="true" aria-label="Loading modules">
      <section className="flex min-w-0 flex-col gap-3" aria-hidden>
        <div className="grid items-center gap-2 sm:[grid-template-columns:1fr_auto_1fr]">
          <div className="flex items-center gap-2 sm:justify-self-start">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-self-center">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {Array.from({ length: MODULE_CARDS }).map((_, i) => (
            <ModuleCardSkeleton key={i} />
          ))}
        </div>

        <ZentraPaginationSkeleton />
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-hidden>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {Array.from({ length: SUBMISSION_CARDS }).map((_, i) => (
            <SubmissionCardSkeleton key={i} />
          ))}
        </div>

        <ZentraPaginationSkeleton />
      </section>
    </div>
  );
}
