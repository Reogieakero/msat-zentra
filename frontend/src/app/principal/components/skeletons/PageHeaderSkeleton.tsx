import { Skeleton } from "@/components/ui/skeleton";
import styles from "./PageHeaderSkeleton.module.css";

export function PageHeaderSkeleton({
  withActions = false,
  actionCount = 1,
}: {
  withActions?: boolean;
  actionCount?: number;
}) {
  return (
    <div className={styles.header} aria-hidden="true">
      <div className={styles.headerText}>
        <Skeleton className={styles.title} />
        <Skeleton className={styles.subtitle} />
      </div>
      {withActions ? (
        <div className={styles.headerActions}>
          {Array.from({ length: actionCount }).map((_, i) => (
            <Skeleton key={i} className={styles.action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
