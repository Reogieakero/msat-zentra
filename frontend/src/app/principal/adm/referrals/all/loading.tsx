import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../../components/skeletons/PageHeaderSkeleton";

export default function PrincipalAdmReferralsLoading() {
  return (
    <section aria-label="Loading referrals" aria-busy="true" className="flex min-w-0 flex-col gap-3">
      <PageHeaderSkeleton />
      <div className="rounded-md border p-4" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="mt-4 overflow-hidden rounded-md border">
          <div className="flex gap-0 bg-muted/50">
            {["Student", "Grade", "Stage", "Eligibility", "Approval", "Forms", "Date"].map((h) => (
              <div key={h} className="h-10 flex-1 px-3 py-2 text-xs font-medium text-muted-foreground">
                {h}
              </div>
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t px-3 py-2">
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
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
