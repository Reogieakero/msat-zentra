"use client";

import { Skeleton } from "@/components/ui/skeleton";
import assign from "./section-assignments.module.css";
import page from "../assign.module.css";

const SKELETON_ROWS = 6;

export function AssignSkeleton() {
  return (
    <div className={page.skelWrap} role="status" aria-label="Loading sections" aria-busy="true">
      <div className={page.headerRow} aria-hidden="true">
        <div className={page.header}>
          <Skeleton className={page.skelTitle} />
          <Skeleton className={page.skelSubtitle} />
        </div>
        <Skeleton className={page.skelBtn} />
      </div>

      <div className={page.card} aria-hidden="true">
        <div className={assign.filterRow}>
          <div>
            <Skeleton className={page.skelCardTitle} />
            <Skeleton className={page.skelCardSub} />
          </div>
          <Skeleton className={page.skelFilter} />
        </div>
        <div className={assign.grid}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className={assign.skelRowGrid}>
              <Skeleton className={`${assign.skelBadge} ${assign.gradeFloat}`} />
              <div className={assign.cardHead}>
                <Skeleton className={assign.skelAvatar} />
                <div className={assign.cardTitleBlock}>
                  <Skeleton className={assign.skelLabel} />
                  <Skeleton className={assign.skelName} />
                </div>
              </div>
              <div className={assign.teacherBlock}>
                <Skeleton className={assign.skelLabel} />
                <Skeleton className={assign.skelTeacher} />
              </div>
              <div className={assign.skelActionsRow}>
                <Skeleton className={assign.skelAction} />
                <Skeleton className={assign.skelAction} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
