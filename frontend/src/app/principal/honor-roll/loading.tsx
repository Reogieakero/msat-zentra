import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./honor-roll.module.css";

export default function PrincipalHonorRollLoading() {
  return (
    <section className={styles.page} aria-label="Loading honor roll" aria-busy="true">
      <PageHeaderSkeleton withActions />
      <div className="flex flex-col gap-2 rounded-md border p-6" aria-hidden="true">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className={styles.toolbar} aria-hidden="true">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="overflow-hidden rounded-md border" aria-hidden="true">
        <div className="flex gap-2 bg-muted/50 px-3 py-2">
          {["Student", "Section", "Term Avg", "Subjects"].map((h) => (
            <span key={h} className="text-xs font-medium text-muted-foreground">
              {h}
            </span>
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t px-3 py-2">
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-14" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="size-8" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
