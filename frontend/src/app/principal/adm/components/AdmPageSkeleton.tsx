import { Skeleton } from "@/components/ui/skeleton";
import layoutStyles from "./admAttentionRail.module.css";

/** One kanban board placeholder: header line, chart body, insight strip. */
function BoardSkeleton({ body = "h-40" }: { body?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Skeleton className="size-3.5 rounded-sm" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className={`w-full ${body}`} />
      <Skeleton className="mt-auto h-12 w-full" />
    </div>
  );
}

/**
 * Layout-matched skeleton for /principal/adm — same stack + rail grid as the
 * loaded desk (findings strip, chart row, insights row, risk row) so the page
 * never flashes an empty canvas while the dashboard query resolves.
 */
export function AdmPageSkeleton() {
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-busy="true"
      aria-label="Loading ADM report"
    >
      <div className={layoutStyles.layout} aria-hidden="true">
        <div className={layoutStyles.stack}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <BoardSkeleton key={i} body="h-10" />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <BoardSkeleton key={i} body="h-60" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <BoardSkeleton key={i} body="h-44" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <BoardSkeleton key={i} body="h-44" />
            ))}
          </div>
          <BoardSkeleton body="h-52" />
        </div>
        <div>
          <Skeleton className="size-9 rounded-xl" />
        </div>
      </div>
    </section>
  );
}
