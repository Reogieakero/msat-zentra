"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { ChevronLeft, ChevronRight, CalendarDays, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WEEK_SCHEDULE,
  WEEK_LABELS_SHORT,
  WEEK_LABELS_FULL,
  TIMELINE,
  LUNCH_START,
  LUNCH_END,
  HOUR_HEIGHT,
  type ScheduleBlock,
} from "./classes-data";
import { ClassDetailDialog } from "./ClassDetailDialog";
import styles from "./ClassesSchedule.module.css";

const PX_PER_MIN = HOUR_HEIGHT / 60;
const CELL_PAD = 8; // 8px spacing from cell gutters (top/bottom)
const HEADER_PX = 28; // 1.75rem — height of the day header, offsets the timeline
const DAYS = [1, 2, 3, 4, 5];
const TOTAL_MIN = TIMELINE[TIMELINE.length - 1].offset;
const GUTTER_HEIGHT = HEADER_PX + TOTAL_MIN * PX_PER_MIN;

export function ClassesSchedule() {
  const [selected, setSelected] = useState<ScheduleBlock | null>(null);
  const blocksByDay = DAYS.map((d) => WEEK_SCHEDULE.filter((b) => b.day === d));

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Class Schedule</CardTitle>
          <CardDescription>Weekly timetable · Sep 7 – 11, 2026</CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <span className={styles.monthLabel}>
            <CalendarDays className={styles.monthIcon} aria-hidden />
            Week of Sep 7, 2026
          </span>
          <div className={styles.nav}>
            <Button variant="outline" size="icon" className={styles.navBtn} aria-label="Previous week">
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className={styles.navBtn} aria-label="Next week">
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className={styles.content}>
        <div className={styles.table}>
          <div
            className={styles.timeGutter}
            style={{ height: GUTTER_HEIGHT }}
          >
            {TIMELINE.map((slot, i) => (
              <span
                key={i}
                className={styles.timeLabel}
                style={{ top: HEADER_PX + slot.offset * PX_PER_MIN }}
              >
                {slot.label}
              </span>
            ))}
          </div>

          {DAYS.map((day, di) => {
            const blocks = blocksByDay[di];
            const isLast = di === DAYS.length - 1;
            return (
              <div
                key={day}
                className={`${styles.dayCol} ${isLast ? styles.dayColLast : ""}`}
              >
                <div className={styles.dayHead}>
                  <span className={styles.dayName}>{WEEK_LABELS_FULL[di]}</span>
                  <span className={styles.dayShort}>{WEEK_LABELS_SHORT[di]}</span>
                </div>
                <div
                  className={`${styles.timeline} ${isLast ? styles.timelineLast : ""}`}
                  style={{ height: TOTAL_MIN * PX_PER_MIN }}
                >
                  {TIMELINE.map((slot, i) => (
                    <div
                      key={i}
                      className={styles.hourLine}
                      style={{ top: slot.offset * PX_PER_MIN }}
                    />
                  ))}

                  <div
                    className={styles.lunchBand}
                    style={{
                      top: LUNCH_START * PX_PER_MIN,
                      height: (LUNCH_END - LUNCH_START) * PX_PER_MIN,
                    }}
                  >
                    <Utensils className={styles.lunchIcon} aria-hidden />
                    Lunch Break
                  </div>

                  <div className={styles.nowLine} style={{ top: 2 * HOUR_HEIGHT }} />

                  {blocks.map((b, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.eventBlock}
                      onClick={() => setSelected(b)}
                      aria-label={`${b.subject}, ${b.activity}: ${b.topic}`}
                      style={
                        {
                          top: b.startMin * PX_PER_MIN + CELL_PAD,
                          height: Math.max(0, (b.endMin - b.startMin) * PX_PER_MIN - CELL_PAD * 2),
                          "--event": b.color,
                        } as React.CSSProperties
                      }
                    >
                      <span className={styles.eventSubject}>{b.subject}</span>
                      <span className={styles.eventMeta}>{b.section} · {b.room}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <ClassDetailDialog block={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
