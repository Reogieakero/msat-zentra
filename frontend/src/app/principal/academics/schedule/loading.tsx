import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../components/skeletons/PageHeaderSkeleton";

export default function PrincipalScheduleLoading() {
  return (
    <section className="flex w-full flex-col gap-5" aria-label="Loading schedule" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]" aria-hidden="true">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border bg-card p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </section>
  );
}
