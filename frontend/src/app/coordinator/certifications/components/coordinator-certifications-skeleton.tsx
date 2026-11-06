"use client";

import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import folders from "./coordinator-certifications-folders.module.css";
import styles from "./coordinator-certifications.module.css";

const TAB_WIDTHS = ["w-12", "w-16", "w-20", "w-24", "w-20"];

/**
 * Loading state for the certifications desk. Structurally identical to the
 * loaded board — board shell, centered status tabs, header search, folder card
 * grid and pager — so the content does not jump when data arrives.
 */
export function CoordinatorCertificationsSkeleton() {
  return (
    <section
      className={styles.page}
      aria-busy="true"
      aria-label="Certifications"
    >
      <div className={styles.layout}>
        <div className={styles.main}>
          <KanbanBoard
            title={<Skeleton className="h-4 w-36" />}
            description={<Skeleton className="h-3 w-64 max-w-full" />}
            ariaLabel="Loading certifications"
            headerCenter={
              <div className={folders.filterRow}>
                {TAB_WIDTHS.map((width, i) => (
                  <Skeleton key={i} className={`h-5 rounded-md ${width}`} />
                ))}
              </div>
            }
            actions={
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-8 w-60 rounded-2xl" />
              </div>
            }
            footer={
              <div className="flex items-center justify-between gap-3 py-2">
                <Skeleton className="h-3 w-32" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="h-7 w-20 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>
            }
          >
            <div className={folders.studentGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <article
                  key={i}
                  className={folders.certCard}
                  style={{ animationDelay: `${Math.min(i, 11) * 60}ms` }}
                  aria-hidden="true"
                >
                  <div className={folders.certCardHead}>
                    <Skeleton className="h-[18px] w-24 rounded-md" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <div className={folders.certCardBody}>
                    <div className={folders.certPills}>
                      <Skeleton className="h-[18px] w-32 rounded-md" />
                      <Skeleton className="h-[18px] w-20 rounded-md" />
                      <Skeleton className="h-[18px] w-10 rounded-md" />
                    </div>
                    <div className={folders.certFolderRow}>
                      <Skeleton className="h-24 w-40 rounded-md" />
                      <Skeleton className="size-[52px] rounded-full" />
                    </div>
                  </div>
                  <div className={folders.folderActions}>
                    <Skeleton className="h-6 w-16 rounded-md" />
                  </div>
                </article>
              ))}
            </div>
          </KanbanBoard>
        </div>

        <div className={styles.railSkel} aria-hidden>
          <Skeleton className={styles.railSkelIcon} />
          <Skeleton className={styles.railSkelIcon} />
        </div>
      </div>
    </section>
  );
}
