import { Skeleton } from "@/components/ui/skeleton";
import styles from "./audit-skeleton.module.css";

export function AuditSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={styles.wrap} aria-hidden>
      <div className={styles.headRow}>
        <Skeleton className={styles.cell} />
        <Skeleton className={styles.cell} />
        <Skeleton className={styles.cell} />
        <Skeleton className={styles.cell} />
        <Skeleton className={styles.cell} />
        <Skeleton className={styles.cellWide} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div className={styles.row} key={i}>
          <Skeleton className={styles.cell} />
          <Skeleton className={styles.cell} />
          <Skeleton className={styles.cell} />
          <Skeleton className={styles.cell} />
          <Skeleton className={styles.cell} />
          <Skeleton className={styles.cellWide} />
        </div>
      ))}
    </div>
  );
}
