import { Skeleton } from "@/components/ui/skeleton";

export default function PrincipalAdmReferralsLoading() {
  return (
    <section aria-label="Loading referrals" aria-busy="true" className="flex min-w-0 flex-col gap-3">
      <div className="rounded-xl border border-border p-2.5" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-1 pb-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {[0, 1].map((lane) => (
            <div key={lane} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5">
              <Skeleton className="h-4 w-36" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1].map((card) => (
                  <div key={card} className="flex flex-col gap-2 rounded-xl border border-border p-2.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="mx-auto h-20 w-32" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
