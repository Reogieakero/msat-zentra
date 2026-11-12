import { Skeleton } from "@/components/ui/skeleton";
import styles from "./SectionCardGrid.module.css";

/**
 * Loading placeholder that mirrors a real section card: header row (name +
 * grade pill, data-source pill) over the inner metrics panel with three stat
 * columns. Kept structurally identical so the board doesn't jump when data
 * arrives.
 */
export function SectionCardSkeleton() {
  return (
    <div className={styles.cardSkeleton} aria-hidden>
      <div className={styles.cardHead}>
        <span className={styles.cardHeading}>
          <Skeleton className={styles.skeletonName} />
          <Skeleton className={styles.skeletonGrade} />
        </span>
        <Skeleton className={styles.skeletonSource} />
      </div>
      <div className={styles.cardPanel}>
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className={styles.stat}>
            <Skeleton className={styles.skeletonStatIcon} />
            <Skeleton className={styles.skeletonStatPill} />
            <Skeleton className={styles.skeletonStatLabel} />
          </span>
        ))}
      </div>
    </div>
  );
}
