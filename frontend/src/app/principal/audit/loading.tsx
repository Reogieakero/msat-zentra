import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./page.module.css";

export default function PrincipalAuditLoading() {
  return (
    <section className={styles.page} aria-label="Loading audit log" aria-busy="true">
      <PageHeaderSkeleton />
      <section aria-label="Audit entries" className="flex min-w-0 flex-col gap-3">
        <div className="rounded-md border p-4" aria-hidden="true">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none border-t first:border-t-0" />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2" aria-hidden="true">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </section>
    </section>
  );
}
