import { Skeleton } from "@/components/ui/skeleton";
import styles from "./page.module.css";

export default function PrincipalAuditLoading() {
  return (
    <section className={styles.page} aria-label="Loading audit log" aria-busy="true">
      <section aria-label="Audit log" className="flex min-w-0 flex-col gap-3">
        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5"
          aria-hidden="true"
        >
          {/* Title row: board title + search/filter strip. */}
          <div className="-mx-2.5 flex items-center gap-2 border-b border-border px-3.5 pb-2">
            <Skeleton className="h-4 w-24 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>

          <Skeleton className="mx-1 h-3.5 w-80" />

          <div className="overflow-hidden rounded-md border">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none border-t first:border-t-0" />
            ))}
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </section>
    </section>
  );
}
