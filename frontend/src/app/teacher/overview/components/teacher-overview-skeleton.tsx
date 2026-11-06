"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoardSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import charts from "./teacher-overview-charts.module.css";
import layout from "./teacher-overview.module.css";
import skeleton from "./teacher-overview-skeleton.module.css";

/** Reserves the "What it means" footer so the boards keep their real height. */
function InterpretationSkeleton() {
  return (
    <div className={skeleton.footerRail} aria-hidden="true">
      <Skeleton className={skeleton.footerLine} style={{ width: "88%" }} />
      <Skeleton className={skeleton.footerLine} style={{ width: "62%" }} />
    </div>
  );
}

/**
 * Mirrors the loaded overview exactly: three chart boards across, two wide
 * trend boards, the full-width pipeline board, and the "My day" right rail
 * (profile + needs attention).
 */
export function TeacherOverviewSkeleton() {
  return (
    <section
      className={layout.page}
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className={layout.body}>
        <div className={layout.mainCol}>
          <div className={charts.stack}>
            {/* Risk mix · Students by risk factor · Subject averages */}
            <div className={charts.grid}>
              <KanbanBoardSkeleton
                titleWidth="6rem"
                showCount
                showDescription
                footer={<InterpretationSkeleton />}
              >
                <div className={skeleton.body}>
                  <div className={skeleton.donutRow}>
                    <Skeleton className={skeleton.donut} />
                    <div className={skeleton.legendCol}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className={skeleton.legendRow} />
                      ))}
                    </div>
                  </div>
                </div>
              </KanbanBoardSkeleton>

              <KanbanBoardSkeleton
                titleWidth="10rem"
                showCount
                showDescription
                footer={<InterpretationSkeleton />}
              >
                <div className={skeleton.body}>
                  <div className={skeleton.bars}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className={skeleton.barRow} />
                    ))}
                  </div>
                </div>
              </KanbanBoardSkeleton>

              <KanbanBoardSkeleton
                titleWidth="8rem"
                showCount
                showDescription
                footer={<InterpretationSkeleton />}
              >
                <div className={skeleton.body}>
                  <div className={skeleton.donutCenter}>
                    <Skeleton className={skeleton.donutLarge} />
                  </div>
                </div>
              </KanbanBoardSkeleton>
            </div>

            {/* At-risk detection · Attendance, day by day */}
            <div className={charts.gridWide}>
              {[2, 4].map((legendRows) => (
                <KanbanBoardSkeleton
                  key={legendRows}
                  titleWidth={legendRows === 2 ? "12rem" : "11rem"}
                  showCount
                  showDescription
                  footer={<InterpretationSkeleton />}
                >
                  <div className={skeleton.body}>
                    <Skeleton className={skeleton.chartPlate} />
                    <div className={skeleton.legendCol}>
                      {Array.from({ length: legendRows }).map((_, i) => (
                        <Skeleton key={i} className={skeleton.legendRow} />
                      ))}
                    </div>
                  </div>
                </KanbanBoardSkeleton>
              ))}
            </div>

            {/* Assessment pipeline */}
            <KanbanBoardSkeleton
              titleWidth="9rem"
              showCount
              showDescription
              footer={<InterpretationSkeleton />}
            >
              <div className={skeleton.body}>
                <Skeleton className={skeleton.chartPlate} style={{ height: "176px" }} />
                <div className={skeleton.legendInline}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className={skeleton.legendChip} />
                  ))}
                </div>
              </div>
            </KanbanBoardSkeleton>
          </div>
        </div>

        <aside className={layout.sideCol} style={{ top: "4rem" }}>
          <div className={layout.railHead}>
            <Skeleton className={skeleton.railTitle} />
            <Skeleton className={skeleton.railToggle} />
          </div>
          <div className={layout.railExpanded}>
            <KanbanBoardSkeleton titleWidth="4.5rem">
              <Skeleton className={skeleton.profileCard} />
            </KanbanBoardSkeleton>
            <KanbanBoardSkeleton titleWidth="7rem" showCount showDescription>
              <div className={skeleton.body}>
                <Skeleton className={skeleton.riskSummary} />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className={skeleton.riskCard} />
                ))}
              </div>
            </KanbanBoardSkeleton>
          </div>
        </aside>
      </div>
    </section>
  );
}
