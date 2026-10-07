import { Skeleton } from "@/components/ui/skeleton";

/* Mirrors risk/students: heatmap + StudentsListTable (20/pg, pager footer). */
export default function PrincipalRiskStudentsLoading() {
  return (
    <section aria-label="Loading at-risk students" aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-48 w-full" aria-hidden="true" />
      <div className="rounded-md border p-4" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="mt-4 overflow-hidden rounded-md border">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t px-3 py-2 first:border-t-0">
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2" aria-hidden="true">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </section>
  );
}
