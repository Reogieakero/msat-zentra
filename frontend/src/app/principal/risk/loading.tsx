import { Skeleton } from "@/components/ui/skeleton";
import styles from "./risk.module.css";

export default function PrincipalRiskLoading() {
  return (
    <section className={styles.page} aria-label="Loading risk board" aria-busy="true">
      <div className={styles.topSummary} aria-hidden="true">
        <div className="flex flex-col gap-3 rounded-xl border p-2.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="size-36 self-center rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border p-2.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border p-2.5" aria-hidden="true">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-[250px] w-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border p-2.5" aria-hidden="true">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border p-2.5" aria-hidden="true">
        <Skeleton className="h-4 w-56" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </section>
  );
}
