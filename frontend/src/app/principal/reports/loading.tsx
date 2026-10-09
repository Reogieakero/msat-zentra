import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./page.module.css";

export default function PrincipalReportsLoading() {
  return (
    <section className={styles.page} aria-label="Loading reports" aria-busy="true">
      <PageHeaderSkeleton withActions actionCount={2} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className={styles.rows} aria-hidden="true">
        {Array.from({ length: 3 }).map((_, ri) => (
          <div className={styles.row} key={ri}>
            <div className={`${styles.frame} ${styles.cols2}`}>
              <Skeleton className="h-64 w-full" />
            </div>
            <div className={styles.frame}>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
