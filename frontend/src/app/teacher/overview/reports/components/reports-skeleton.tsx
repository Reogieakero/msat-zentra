"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./reports.module.css";

function StatColumns({ count }: { count: number }) {
  return (
    <div className={styles.statGrid} style={{ ["--cols" as string]: count }} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.statColumn}>
          <Skeleton className="h-4 w-24" />
          <div className={styles.statCard}>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="mt-1 h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading term report">
      <StatColumns count={5} />
      <StatColumns count={6} />
      <div className={styles.card}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72" />
        <div className="mt-2 flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
