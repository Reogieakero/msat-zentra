"use client";

import {
  KanbanBoardSkeleton,
  RowListSkeleton,
} from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import {
  TeacherOverviewActions,
  type QuickAction,
} from "./teacher-overview-actions";
import layout from "./teacher-overview.module.css";

interface TeacherOverviewSkeletonProps {
  actions: QuickAction[];
}

/* Mirrors the real overview: Actions, then the adviser/class RiskTable +
   Attendance + Anecdotes boards (each a KanbanBoard around a RowList), and
   the Profile + RiskLane rail. Uses the shared kit so board geometry is the
   same component shell the loaded page renders. */
export function TeacherOverviewSkeleton({ actions }: TeacherOverviewSkeletonProps) {
  return (
    <section
      className={layout.page}
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className={layout.body}>
        <div className={layout.mainCol}>
          <TeacherOverviewActions actions={actions} />
          <KanbanBoardSkeleton rows={0} titleWidth="10rem" showCount>
            <RowListSkeleton rows={5} gutter="0.625rem" withDatePill />
          </KanbanBoardSkeleton>
          <KanbanBoardSkeleton rows={0} titleWidth="9rem" showCount>
            <RowListSkeleton rows={4} gutter="0.625rem" />
          </KanbanBoardSkeleton>
          <KanbanBoardSkeleton rows={0} titleWidth="8rem" showCount>
            <RowListSkeleton rows={4} gutter="0.625rem" />
          </KanbanBoardSkeleton>
        </div>
        <aside className={layout.sideCol} style={{ top: "4rem" }}>
          <KanbanBoardSkeleton rows={3} titleWidth="6rem" />
          <KanbanBoardSkeleton rows={4} titleWidth="7rem" />
        </aside>
      </div>
    </section>
  );
}
