import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../../components/skeletons/PageHeaderSkeleton";
import styles from "./components/records.module.css";

export default function PrincipalRecordsHeatmapLoading() {
  return (
    <section className={styles.page} aria-label="Loading records heatmap" aria-busy="true">
      <PageHeaderSkeleton />
      <div className={styles.topRow} aria-hidden="true">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </section>
  );
}
