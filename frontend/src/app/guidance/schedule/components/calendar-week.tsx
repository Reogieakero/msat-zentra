"use client";

import {
  addDays,
  format,
  isToday,
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

const START_HOUR = 6;
const END_HOUR = 21;
const HOUR_REM = 3;
const DEFAULT_DURATION_MIN = 60;
const DAY_HEIGHT_REM = (END_HOUR - START_HOUR) * HOUR_REM;

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

interface PositionedEvent {
  event: GuidanceCalendarEvent;
  topRem: number;
  heightRem: number;
  lane: number;
  lanes: number;
}

/** Greedy lane packing so overlapping sessions sit side by side. */
function packDay(events: GuidanceCalendarEvent[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const laneEnds: number[] = [];
  const placed: { event: GuidanceCalendarEvent; start: number; end: number; lane: number }[] = [];

  for (const event of sorted) {
    const start = new Date(event.start).getTime();
    const end = start + DEFAULT_DURATION_MIN * 60_000;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    placed.push({ event, start, end, lane });
  }

  const lanes = Math.max(1, laneEnds.length);
  return placed.map(({ event, lane }) => {
    const date = new Date(event.start);
    const minutes = date.getHours() * 60 + date.getMinutes();
    const clampStart = Math.max(START_HOUR * 60, minutes);
    const clampEnd = Math.min(END_HOUR * 60, minutes + DEFAULT_DURATION_MIN);
    return {
      event,
      topRem: ((clampStart - START_HOUR * 60) / 60) * HOUR_REM,
      heightRem: Math.max(1.5, ((clampEnd - clampStart) / 60) * HOUR_REM),
      lane,
      lanes,
    };
  });
}

export function CalendarWeek({
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
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className={styles.weekScroll}>
      <div className={styles.weekHead}>
          <div className={styles.weekHeadCorner} />
          {days.map((day) => {
            const key = dateKey(day);
            return (
              <button
                key={key}
                type="button"
                className={`${styles.weekDayHead} ${isToday(day) ? styles.weekDayHeadToday : ""}`}
                onClick={() => onSelectDay(key)}
              >
                <span className={styles.weekDayName}>{format(day, "EEE")}</span>
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        <div className={styles.weekBody}>
          <div className={styles.hours} aria-hidden="true">
            {HOURS.map((hour) => (
              <div key={hour} className={styles.hourLabel}>
                {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = dateKey(day);
            const positioned = packDay(eventsOnDay(grouped, key));
            return (
              <div
                key={key}
                className={styles.dayCol}
                style={{ height: `${DAY_HEIGHT_REM}rem` }}
                onClick={() => onSelectDay(key)}
                role="button"
                tabIndex={0}
                aria-label={format(day, "EEEE, MMMM d")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDay(key);
                  }
                }}
                data-selected={key === selectedKey ? "true" : undefined}
              >
                {positioned.map(({ event, topRem, heightRem, lane, lanes }) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`${styles.weekEvent} ${isClosed(event) ? styles.chipCancelled : ""}`}
                    data-track={event.track}
                    style={{
                      top: `${topRem}rem`,
                      height: `${heightRem}rem`,
                      left: `calc(${(lane / lanes) * 100}% + 1px)`,
                      width: `calc(${100 / lanes}% - 3px)`,
                    }}
                    title={`${formatTime(event.start)} · ${sessionTypeLabel(event.sessionType)} · ${event.learner}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                  >
                    <span className={styles.weekEventTime}>
                      <span className={styles.chipDot} aria-hidden="true" />
                      {formatTime(event.start)}
                    </span>
                    <span className={styles.weekEventName}>{event.learner}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
    </div>
  );
}
