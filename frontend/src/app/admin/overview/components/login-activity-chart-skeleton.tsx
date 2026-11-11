"use client";

import { Skeleton } from "@/components/ui/skeleton";
import styles from "./login-activity-chart.module.css";

/**
 * Loading shell for the login-activity chart. Mirrors the real layout exactly
 * (headline + three stat pills, the plot box and the two legend rows) so the
 * board does not jump when the data lands.
 */
export default function LoginActivityChartSkeleton() {
  return (
    <div className={styles.chart} aria-hidden="true">
      <div className={styles.head}>
        <Skeleton className="h-3 w-32" />
        <span className={styles.meta}>
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </span>
      </div>

      <div className={styles.plot}>
        <Skeleton className={styles.plotSkeleton} />
      </div>

      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <Skeleton className="h-2 w-2 rounded-sm" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-4" />
        </li>
        <li className={styles.legendItem}>
          <Skeleton className="h-2 w-2 rounded-sm" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-4" />
        </li>
      </ul>

      <div className={styles.latest}>
        <div className={styles.filterTabs}>
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
        <ul className={styles.latestList}>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className={styles.latestRow}>
              <Skeleton className="h-[22px] w-[22px] rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
