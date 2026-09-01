"use client";

import * as React from "react";
import {
  CalendarDays,
  Activity,
  TriangleAlert,
  TrendingUp,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./AttendanceHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: CalendarDays,
    title: "Daily Heatblocks",
    body: "Per-section daily attendance blocks, color-coded against the 80% threshold.",
  },
  {
    icon: Clock,
    title: "AM / PM Sessions",
    body: "Compare morning and afternoon attendance across every section.",
  },
  {
    icon: Activity,
    title: "Section Averages",
    body: "Average present-per-day and how many days each section dipped below 80%.",
  },
  {
    icon: TrendingUp,
    title: "School-wide Trend",
    body: "Track the daily present-student count for the current session.",
  },
  {
    icon: TriangleAlert,
    title: "Needs Attention",
    body: "Surface the sections (or students) that are running below 80%.",
  },
  {
    icon: Users,
    title: "Drill into a Section",
    body: "Pick any section to see its full per-student attendance table.",
  },
];

function Carousel() {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className={styles.carousel}>
      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.row}>
          {SLIDES.map((slide) => (
            <article key={slide.title} className={styles.card}>
              <div className={styles.heading}>
                <slide.icon className={styles.icon} aria-hidden />
                <h2 className={styles.title}>{slide.title}</h2>
              </div>
              <p className={styles.body}>{slide.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
        >
          <ChevronLeft className={styles.arrowIcon} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
        >
          <ChevronRight className={styles.arrowIcon} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function AttendanceHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Attendance Heatmap</h1>
        <p className={styles.heroSubtitle}>
          A daily, per-section view of attendance across every grade and
          section — with averages, trends, and a drill-down into at-risk
          students, all benchmarked on the 80% threshold.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <Carousel />
      </div>
    </div>
  );
}
