"use client";
import * as React from "react";
import { Clock } from "lucide-react";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-header.module.css";
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
interface UpNextSlot {
  day: number;
  period: number;
  subject: { name: string };
  section: { name: string };
}
export function TeacherOverviewUpNext({
  slots,
  config,
}: {
  slots: UpNextSlot[];
  config: DayConfig | null;
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const entries = React.useMemo(() => {
    if (!config || slots.length === 0) return [];
    const rows = buildTimetable(config);
    const timeOf = (period: number) => {
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
    };
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dow = now.getDay();
    const out: {
      key: string;
      subject: string;
      section: string;
      when: string;
      startsInSec: number | null;
    }[] = [];
    for (let d = dow; d <= 5 && out.length < 2; d += 1) {
      const daySlots = slots
        .filter((s) => s.day === d)
        .map((s) => ({ slot: s, time: timeOf(s.period) }))
        .filter(
          (r): r is { slot: UpNextSlot; time: { start: number; end: number } } =>
            !!r.time && (d > dow || r.time.start > nowMin),
        )
        .sort((a, b) => a.time.start - b.time.start);
      for (const r of daySlots) {
        if (out.length >= 2) break;
        const dayLabel = d === dow ? "Today" : WEEK_DAYS[d - 1];
        const startsInSec =
          d === dow
            ? Math.max(
                0,
                r.time.start * 60 -
                  (now.getHours() * 3_600 + now.getMinutes() * 60 + now.getSeconds()),
              )
            : null;
        out.push({
          key: `${d}:${r.slot.period}:${r.slot.subject.name}:${r.slot.section.name}`,
          subject: r.slot.subject.name,
          section: r.slot.section.name,
          when: `${dayLabel} · ${formatRange(r.time.start, r.time.end)}`,
          startsInSec,
        });
      }
    }
    return out;
  }, [slots, config, now]);
  const formatCountdown = (totalSec: number): string => {
    const h = Math.floor(totalSec / 3_600);
    const m = Math.floor((totalSec % 3_600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  return (
    <div className={assign.card} aria-label="Up next">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Clock size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Up next</h3>
          <p className="text-xs text-muted-foreground">
            Upcoming subjects from now.
          </p>
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5">
        {entries.length === 0 ? (
          <p className={styles.classEmpty}>No upcoming classes scheduled.</p>
        ) : (
          entries.map((e, i) => (
            <div key={e.key} className="flex items-start justify-between gap-2">
              <span className={styles.classText}>
                <span className={styles.classSubject}>{e.subject}</span>
                <span className={styles.classMeta}>
                  {e.section} · {e.when}
                </span>
              </span>
              {i === 0 && e.startsInSec !== null ? (
                <span
                  className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-bold tabular-nums text-primary"
                  title="Starts in"
                  aria-label={`Starts in ${formatCountdown(e.startsInSec)}`}
                >
                  {formatCountdown(e.startsInSec)}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
