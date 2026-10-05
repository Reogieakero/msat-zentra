"use client";

import { Skeleton } from "@/components/ui/skeleton";
import cardStyles from "./coordinator-enrolled-card.module.css";

/* Full-section loading state that mirrors the enrolled card grid 1:1 —
   card-shaped mirrors (visual, title, facts, progress bar, meta, CTA) —
   so skeleton → content swaps with minimal layout shift. Filters stay
   mounted above; this covers the grid only. */
export function CoordinatorEnrolledSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading enrolled students">
      <div className={cardStyles.grid} aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cardStyles.skelCard}>
            <Skeleton className={cardStyles.skelVisual} />
            <div className={cardStyles.skelBody}>
              <Skeleton className={cardStyles.skelTitle} />
              <div className={cardStyles.skelFacts}>
                <Skeleton className={cardStyles.skelFact} />
                <Skeleton className={cardStyles.skelFact} />
                <Skeleton className={cardStyles.skelFact} />
              </div>
              <Skeleton className={cardStyles.skelTrack} />
              <Skeleton className={cardStyles.skelNote} />
              <Skeleton className={cardStyles.skelNote} />
            </div>
            <div className={cardStyles.skelActions}>
              <Skeleton className={cardStyles.skelCta} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
