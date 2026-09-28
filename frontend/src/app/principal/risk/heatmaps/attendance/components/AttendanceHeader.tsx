"use client";

import {
  CalendarDays,
  Activity,
  TriangleAlert,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react";
import styles from "./AttendanceHeader.module.css";

/** Right-sidebar cards. Daily / Subjects / Averages / Trend / Attention switch
 *  the main panel content (and the URL tab); the rest are explainer cards. */
export type HeatmapNavTarget =
  | "daily"
  | "subject"
  | "averages"
  | "trend"
  | "attention";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  target?: HeatmapNavTarget;
};

const SLIDES: Slide[] = [
  {
    icon: CalendarDays,
    title: "Daily Heatblocks",
    body: "Per-section daily attendance blocks, color-coded against the 80% threshold.",
    target: "daily",
  },
  {
    icon: Clock,
    title: "Subjects & Sessions",
    body: "Per-section, per-day rows for each subject (archived terms still show AM/PM).",
    target: "subject",
  },
  {
    icon: Activity,
    title: "Section Averages",
    body: "Average present-per-day and how many days each section dipped below 80%.",
    target: "averages",
  },
  {
    icon: TrendingUp,
    title: "School-wide Trend",
    body: "Track the daily present-student count for the current session.",
    target: "trend",
  },
  {
    icon: TriangleAlert,
    title: "Needs Attention",
    body: "Surface the sections (or students) that are running below 80%.",
    target: "attention",
  },
  {
    icon: Users,
    title: "Drill into a Section",
    body: "Pick any section to see its full per-student attendance table.",
  },
];

export function AttendanceHeader({
  active,
  onNavigate,
}: {
  active: HeatmapNavTarget;
  onNavigate: (target: HeatmapNavTarget) => void;
}) {
  return (
    <aside className={styles.sidebar} aria-label="Attendance views">
      {SLIDES.map((slide) => {
        const inner = (
          <>
            <span className={styles.heading}>
              <slide.icon className={styles.icon} aria-hidden />
              <span className={styles.title}>{slide.title}</span>
            </span>
            <span className={styles.body}>{slide.body}</span>
            <slide.icon className={styles.watermark} aria-hidden />
          </>
        );
        if (!slide.target) {
          return (
            <article key={slide.title} className={styles.card} aria-label={slide.title}>
              {inner}
            </article>
          );
        }
        const selected = active === slide.target;
        return (
          <button
            key={slide.title}
            type="button"
            className={`${styles.card} ${selected ? styles.cardActive : ""}`}
            onClick={() => onNavigate(slide.target as HeatmapNavTarget)}
            aria-pressed={selected}
            aria-label={`Show ${slide.title}`}
          >
            {inner}
          </button>
        );
      })}
    </aside>
  );
}
