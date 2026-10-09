import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "../../../components/skeletons/PageHeaderSkeleton";
import shell from "../components/heatmap.module.css";

export default function PrincipalAcademicsHeatmapLoading() {
  return (
    <div className={shell.shell}>
      <div className={shell.layout}>
        <section className={shell.page} aria-label="Loading academic heatmap" aria-busy="true">
          <PageHeaderSkeleton withActions />
          <div className="grid grid-cols-2 gap-4" aria-hidden="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-80 w-full" aria-hidden="true" />
          <Skeleton className="h-64 w-full" aria-hidden="true" />
        </section>
      </div>
    </div>
  );
}
