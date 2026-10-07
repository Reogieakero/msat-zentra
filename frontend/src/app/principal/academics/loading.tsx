import { Skeleton } from "@/components/ui/skeleton";

/* Mirrors academics desk: section card grid + (on selection) students
   table. Card grid dimensions match SectionCardGrid; table keeps the
   6-column sticky header shape. */
export default function PrincipalAcademicsLoading() {
  return (
    <section aria-label="Loading academics" aria-busy="true" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-md border" aria-hidden="true">
        <div className="flex gap-4 bg-muted/50 px-3 py-2">
          {["Section", "Grade", "Avg", "Pass %", "Fail %", "At-Risk"].map((h) => (
            <span key={h} className="text-xs font-medium text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-none border-t first:border-t-0" />
        ))}
      </div>
    </section>
  );
}
