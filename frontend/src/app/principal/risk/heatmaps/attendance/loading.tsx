import { Skeleton } from "@/components/ui/skeleton";
import styles from "./components/attendance.module.css";

export default function PrincipalAttendanceHeatmapLoading() {
  return (
    <section className={styles.page} aria-label="Loading attendance heatmap" aria-busy="true">
      <div className={styles.kpiGrid} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={styles.kpiSkel} />
        ))}
      </div>
      <div className={styles.stack} aria-hidden="true">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </section>
  );
}
