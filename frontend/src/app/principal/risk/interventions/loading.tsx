import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../components/skeletons/PageHeaderSkeleton";

export default function PrincipalInterventionsLoading() {
  return (
    <section aria-label="Loading interventions" aria-busy="true" className="flex flex-col gap-3">
      <PageHeaderSkeleton />
      <div className="rounded-md border p-4" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-52" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="mt-4 overflow-hidden rounded-md border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t px-3 py-2 first:border-t-0">
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
