"use client";

import { Skeleton } from "@/components/ui/skeleton";
import cardStyles from "./coordinator-enrolled-card.module.css";

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
