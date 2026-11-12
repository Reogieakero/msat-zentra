import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import styles from "./CandidateTable.module.css";

/**
 * Card skeletons that mirror the real awardee board one-for-one, so the
 * route-level and in-page loading states occupy the exact same grid.
 */
export function HonorRollCardSkeletons({ count = 12 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonBoard}>
          <div className={styles.skeletonHead}>
            <Skeleton className={styles.skeletonMascot} />
            <div className={styles.skeletonIdentity}>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className={styles.skeletonPills}>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
          <div className={styles.skeletonFoot}>
            <div>
              <Skeleton className="h-2 w-16" />
              <Skeleton className="mt-1 h-5 w-12" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full honor-roll loading state: header controls + the awardee card grid. */
export function HonorRollSkeleton() {
  return (
    <section
      className={styles.panel}
      aria-label="Loading honor roll"
      aria-busy="true"
    >
      <header className={styles.panelHead}>
        <div className={styles.panelTitleBlock}>
          <h2 className={styles.panelTitle}>
            <span className={styles.panelIcon} aria-hidden="true">
              <Trophy size={14} />
            </span>
            <Skeleton className="h-4 w-56 max-w-full" />
          </h2>
          <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
        </div>
        <div className={styles.panelTools}>
          <Skeleton className="h-6 w-64 max-w-full" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
      </header>
      <HonorRollCardSkeletons />
    </section>
  );
}
