"use client";

import {
  addDays,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { GuidanceCalendarEvent } from "@/services/guidance/calendar.service";
import styles from "./guidance-calendar.module.css";
import {
  dateKey,
  eventsOnDay,
  formatTime,
  isClosed,
  groupByDay,
  sessionTypeLabel,
} from "./calendar-utils";

const MAX_CHIPS = 3;

export function CalendarMonth({
  cursor,
  selectedKey,
  grouped,
  onSelectDay,
  onSelectEvent,
}: {
  cursor: Date;
  selectedKey: string | null;
  grouped: ReturnType<typeof groupByDay>;
  onSelectDay: (key: string) => void;
  onSelectEvent: (event: GuidanceCalendarEvent) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)),
  );

  return (
    <>
      <div className={styles.weekdayRow} aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <div key={name} className={styles.weekday}>
            {name}
          </div>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {weeks.map((week) => (
          <div key={dateKey(week[0])} className={styles.weekRow}>
            {week.map((day) => {
              const key = dateKey(day);
              const events = eventsOnDay(grouped, key);
              const visible = events.slice(0, MAX_CHIPS);
              const hidden = events.length - visible.length;
              const outside = !isSameMonth(day, monthStart);
              return (
                <div
                  key={key}
                  className={[
                    styles.dayCell,
                    outside ? styles.dayCellOut : "",
                    key === selectedKey ? styles.dayCellSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelectDay(key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectDay(key);
                    }
                  }}
                  aria-label={format(day, "EEEE, MMMM d")}
                >
                  <div className={styles.dayNumberRow}>
                    <span className={isToday(day) ? styles.dayNumberToday : undefined}>
                      {format(day, "d")}
                    </span>
                  </div>
                  {visible.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${styles.chip} ${isClosed(event) ? styles.chipCancelled : ""}`}
                      data-track={event.track}
                      title={`${formatTime(event.start)} · ${sessionTypeLabel(event.sessionType)} · ${event.learner}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                    >
                      <span className={styles.chipDot} aria-hidden="true" />
                      <span className={styles.chipTime}>{formatTime(event.start)}</span>
                      <span className={styles.chipName}>{event.learner}</span>
                    </button>
                  ))}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      className={styles.moreChip}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay(key);
                      }}
                    >
                      +{hidden} more
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
