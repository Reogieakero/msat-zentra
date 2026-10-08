import { Skeleton } from "@/components/ui/skeleton";
import styles from "./risk.module.css";

export default function PrincipalRiskLoading() {
  return (
    <section className={styles.page} aria-label="Loading risk board" aria-busy="true">
      <div className={styles.topSummary} aria-hidden="true">
        <div className="flex flex-col items-center gap-3 rounded-md border p-4">
          <Skeleton className="size-36 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-md border p-4" aria-hidden="true">
        <Skeleton className="h-5 w-56" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <hr className={styles.divider} aria-hidden="true" />
      <Skeleton className="h-48 w-full" aria-hidden="true" />
      <hr className={styles.divider} aria-hidden="true" />
      <Skeleton className="h-56 w-full" aria-hidden="true" />
    </section>
  );
}
