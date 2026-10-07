import { Skeleton } from "@/components/ui/skeleton";
import styles from "./components/overview.module.css";

/* Route skeleton: mirrors OverviewRisk (4 KPI cards) + OverviewPopulation
   (matrix) + OverviewAction (rail) — same column, same 1rem gaps, so the
   skeleton → data swap doesn't shift layout. */
export default function PrincipalOverviewLoading() {
  return (
    <section className={styles.page} aria-label="Loading overview" aria-busy="true">
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-md border p-4" aria-hidden="true">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="flex flex-col gap-2 rounded-md border p-4" aria-hidden="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </section>
  );
}
