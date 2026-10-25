import { Skeleton } from "@/components/ui/skeleton";

export default function PrincipalSectionScheduleLoading() {
  return (
    <section className="flex w-full flex-col gap-5" aria-label="Loading schedule" aria-busy="true">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-7 w-24" aria-hidden="true" />
          <Skeleton className="h-72 w-full" aria-hidden="true" />
        </div>
        <div className="flex flex-col items-end gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}
