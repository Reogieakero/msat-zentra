import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../../components/skeletons/PageHeaderSkeleton";

export default function PrincipalSectionScheduleLoading() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-label="Loading schedule" aria-busy="true">
      <PageHeaderSkeleton withActions />
      <Skeleton className="h-72 w-full" aria-hidden="true" />
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </section>
  );
}
