import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";

export default function PrincipalAdmLoading() {
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Loading ADM" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" aria-hidden="true" />
      <Skeleton className="h-32 w-full" aria-hidden="true" />
    </section>
  );
}
