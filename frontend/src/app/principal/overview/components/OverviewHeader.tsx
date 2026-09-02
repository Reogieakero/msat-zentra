"use client";

import * as React from "react";
import {
  Users,
  LayoutDashboard,
  ShieldAlert,
  CalendarDays,
  FileSignature,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./OverviewHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: Users,
    title: "Enrollment Snapshot",
    body: "Live enrolled students, active sections, teachers, and anecdotal records this term.",
  },
  {
    icon: ShieldAlert,
    title: "At-Risk Breakdown",
    body: "Students flagging on attendance, grades, and behavior — computed live from the same risk engine as the Risk pages.",
  },
  {
    icon: CalendarDays,
    title: "Attendance Watch",
    body: "Sections tracking below the 80% present threshold, alongside the daily heatmap.",
  },
  {
    icon: FileSignature,
    title: "Action Required",
    body: "ADM referrals, pending accounts, and at-risk learners that need principal follow-up.",
  },
  {
    icon: GraduationCap,
    title: "Honor Roll",
    body: "Locked final grades with an average and lowest grade that qualify for honors.",
  },
  {
    icon: LayoutDashboard,
    title: "Live Counts",
    body: "This page never shows mocked numbers — every card and section reads from the active term.",
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

export function OverviewHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Principal Overview</h1>
        <p className={styles.heroSubtitle}>
          A school-wide summary of enrollment, at-risk learners, attendance, and
          the actions that need your attention — all computed live from the
          active term.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <Carousel />
      </div>
    </div>
  );
}
