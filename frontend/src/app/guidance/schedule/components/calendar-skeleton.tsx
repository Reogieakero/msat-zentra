"use client";

import { addDays, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import styles from "./guidance-calendar.module.css";
import type { CalendarView } from "./calendar-toolbar";
import { dateKey } from "./calendar-utils";
import { DAY_HEIGHT_REM, HOURS } from "./calendar-week";

/**
 * Loading shell for the guidance calendar. It renders the exact loaded
 * geometry — real kanban board shell, toolbar, filter pill row, weekday row,
 * month/week grid and day rail — so the board does not move when the events
 * land. Only the leaves are placeholders.
 */

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FILTER_PILLS = [4.4, 5.4, 4.9, 6.6, 6.2];
/** Deterministic chip counts per weekday position, so cells look populated. */
const MONTH_CHIP_PATTERN = [0, 1, 2, 0, 1, 3, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 1, 2, 0, 3, 1, 0];
/** Fixed in-day slots for the week grid placeholder events (rem offsets). */
const WEEK_PLACEHOLDERS: { top: number; height: number }[][] = [
  [{ top: 2.25, height: 3 }],
  [{ top: 7.5, height: 3 }, { top: 15, height: 3 }],
  [{ top: 4.5, height: 3 }],
  [{ top: 10.5, height: 3 }],
  [{ top: 1.5, height: 3 }, { top: 19.5, height: 3 }],
  [{ top: 6, height: 3 }],
  [],
];

function ToolbarSkeleton() {
  return (
    <div className={styles.toolbar} aria-hidden="true">
      <div className={styles.navGroup}>
        <Skeleton className={styles.navButton} />
        <span className={styles.monthLabel}>
          <Skeleton className="mx-auto h-3 w-24" />
        </span>
        <Skeleton className={styles.navButton} />
        <Skeleton className="h-7 w-14 rounded-md" />
      </div>

      <div className={styles.segmented}>
        <Skeleton className="h-5 w-[3.6rem] rounded-full" />
        <Skeleton className="h-5 w-[3.4rem] rounded-full" />
      </div>

      <div className={styles.searchWrap}>
        <Skeleton className={`${styles.search} w-full`} />
      </div>
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className={styles.filters} aria-hidden="true">
      {FILTER_PILLS.map((width, i) => (
        <Skeleton key={i} className="h-5 rounded-full" style={{ width: `${width}rem` }} />
      ))}
    </div>
  );
}

function MonthSkeleton({ cursor }: { cursor: Date }) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)),
  );

  return (
    <div aria-hidden="true">
      <div className={styles.weekdayRow}>
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className={styles.weekday}>
            <Skeleton className="h-2.5 w-7" />
          </div>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {weeks.map((week, weekIndex) => (
          <div key={dateKey(week[0])} className={styles.weekRow}>
            {week.map((day, dayIndex) => {
              const outside = !isSameMonth(day, monthStart);
              const chips =
                MONTH_CHIP_PATTERN[(weekIndex * 7 + dayIndex) % MONTH_CHIP_PATTERN.length];
              return (
                <div
                  key={dateKey(day)}
                  className={[styles.dayCell, outside ? styles.dayCellOut : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.dayNumberRow}>
                    <Skeleton className="size-[1.125rem] rounded-full" />
                  </div>
                  {Array.from({ length: chips }).map((_, chip) => (
                    <Skeleton key={chip} className={styles.skelChip} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div className={styles.weekScroll} aria-hidden="true">
      <div className={styles.weekHead}>
        <div className={styles.weekHeadCorner} />
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className={styles.weekDayHead}>
            <Skeleton className="mx-auto h-2 w-6" />
            <Skeleton className="mx-auto mt-1 h-2.5 w-4" />
          </div>
        ))}
      </div>
      <div className={styles.weekBody}>
        <div className={styles.hours}>
          {HOURS.map((hour) => (
            <div key={hour} className={styles.hourLabel}>
              <Skeleton className="ml-auto h-2 w-7" />
            </div>
          ))}
        </div>
        {WEEK_PLACEHOLDERS.map((placements, dayIndex) => (
          <div key={dayIndex} className={styles.dayCol} style={{ height: `${DAY_HEIGHT_REM}rem` }}>
            {placements.map((placement, i) => (
              <div
                key={i}
                className={styles.weekEvent}
                style={{
                  top: `${placement.top}rem`,
                  height: `${placement.height}rem`,
                  left: "2px",
                  width: "calc(100% - 4px)",
                }}
              >
                <span className={styles.weekEventTime}>
                  <span className={styles.chipDot} />
                  <Skeleton className="h-2 w-8" />
                </span>
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RailSkeleton() {
  return (
    <aside className={styles.rail} aria-hidden="true">
      <div className={styles.railHead}>
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>

      <ul className={styles.railList}>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <div className={styles.railCard}>
              <div className={styles.railCardTop}>
                <div className={styles.railPerson}>
                  <Skeleton className="size-[34px] shrink-0 rounded-full" />
                  <div className={styles.railPersonText}>
                    <Skeleton className="h-3.5 w-28" />
                    <div className={styles.railPills}>
                      <Skeleton className="h-4 w-16 rounded-md" />
                      <Skeleton className="h-4 w-20 rounded-md" />
                    </div>
                  </div>
                </div>
                <div className={styles.railWhen}>
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-4 w-14 rounded-md" />
                </div>
              </div>

              <div className={styles.railPills}>
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>

              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function GuidanceScheduleSkeleton({
  view = "month",
  cursor,
}: {
  view?: CalendarView;
  cursor: Date;
}) {
  return (
    <div className={styles.body} aria-busy="true" aria-label="Loading schedule">
      <div className={styles.mainCol}>
        <KanbanBoard
          title={
            <span className={styles.boardTitle}>
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-3 w-24" />
            </span>
          }
          description={<Skeleton className="h-3 w-[26rem] max-w-full" />}
          headerToolbar={<ToolbarSkeleton />}
          toolbar={<FiltersSkeleton />}
        >
          {view === "week" ? <WeekSkeleton /> : <MonthSkeleton cursor={cursor} />}
        </KanbanBoard>
      </div>

      <RailSkeleton />
    </div>
  );
}
