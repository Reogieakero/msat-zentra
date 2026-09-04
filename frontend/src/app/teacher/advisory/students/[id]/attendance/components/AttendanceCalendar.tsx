"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  humanize,
  type AttendanceDay,
  type AttendanceSummary,
} from "./attendance-data";
import { AttendanceInsights } from "./AttendanceInsights";
import styles from "./AttendanceCalendar.module.css";

const STATUS_VARIANTS = {
  present: "success",
  absent: "destructive",
  late: "warning",
  excused: "outline",
} as const;

const DOT_COLORS: Record<string, string> = {
  present: "var(--success, #16a34a)",
  absent: "var(--destructive)",
  late: "var(--warning, #d97706)",
  excused: "var(--muted-foreground)",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SessionMark({ session, status }: { session: "AM" | "PM"; status?: string }) {
  return (
    <span className={styles.sessionRow}>
      <span className={styles.sessionLabel}>{session}</span>
      {status ? (
        <Badge
          variant={STATUS_VARIANTS[status as keyof typeof STATUS_VARIANTS] ?? "outline"}
          className={styles.sessionBadge}
        >
          {humanize(status)}
        </Badge>
      ) : (
        <span className={styles.sessionEmpty}>No record</span>
      )}
    </span>
  );
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthLabel(cursor: Date): string {
  return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface AttendanceCalendarProps {
  summary: AttendanceSummary | null;
  days: AttendanceDay[];
  loading: boolean;
}

export function AttendanceCalendar({ summary, days, loading }: AttendanceCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDate = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const d of days) map.set(d.date, d.sessions);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const list: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= count; d++) {
      list.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return list;
  }, [cursor]);

  const isCurrentMonth =
    cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  if (loading || !summary) {
    return (
      <div className={styles.list} aria-busy="true" aria-label="Loading attendance">
        <AttendanceInsights summary={null} days={[]} loading />
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelCell} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <AttendanceInsights summary={summary} days={days} loading={false} />

      <div className={styles.calHead}>
        <span className={styles.monthLabel}>{monthLabel(cursor)}</span>
        <span className={styles.calNav}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={styles.navBtn}
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          {!isCurrentMonth ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              Today
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={styles.navBtn}
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </span>
      </div>

      <div className={styles.weekRow} aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.weekday}>
            {d}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((key, i) => {
          if (key === null) return <span key={`b-${i}`} className={styles.blank} />;
          const sessions = byDate.get(key) ?? {};
          const dayNum = Number(key.slice(8, 10));
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          const weekday = new Date(`${key}T00:00:00`).getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          return (
            <div
              key={key}
              className={`${styles.dayCell} ${isToday ? styles.dayToday : ""} ${
                isWeekend ? styles.dayWeekend : ""
              } ${isFuture ? styles.dayFuture : ""}`}
            >
              <span className={styles.dayNum}>{dayNum}</span>
              <SessionMark session="AM" status={sessions["AM"]} />
              <hr className={styles.cellDivider} aria-hidden />
              <SessionMark session="PM" status={sessions["PM"]} />
            </div>
          );
        })}
      </div>

      <div className={styles.legend} aria-label="Legend">
        {(Object.keys(DOT_COLORS) as (keyof typeof DOT_COLORS)[]).map((status) => (
          <span key={status} className={styles.legendItem}>
            <span
              className={styles.dot}
              style={{ "--mark": DOT_COLORS[status] } as React.CSSProperties}
              aria-hidden
            />
            {humanize(status)}
          </span>
        ))}
        <span className={styles.legendHint}>Every school day carries AM and PM marks.</span>
      </div>
    </div>
  );
}
