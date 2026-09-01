"use client";

import * as React from "react";
import {
  Users,
  ShieldAlert,
  FileWarning,
  Activity,
  GraduationCap,
  Flame,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./StudentsHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: Users,
    title: "All At-Risk Learners",
    body: "Every learner flagged across the school, scoped down to a section.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Levels",
    body: "High, moderate, and low risk at a glance per section.",
  },
  {
    icon: FileWarning,
    title: "Risk Factors",
    body: "Spot academic, attendance, and behavioral flags on each student.",
  },
  {
    icon: Activity,
    title: "Section Heatmap",
    body: "See which sections concentrate the most risk per factor.",
  },
  {
    icon: Flame,
    title: "Priority Review",
    body: "Search by LRN to jump straight to a specific learner.",
  },
  {
    icon: GraduationCap,
    title: "Per-Grade View",
    body: "Narrow the list down by grade level and section.",
  },
];

function StudentsCarousel() {
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

export function StudentsHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Board Risk — Students</h1>
        <p className={styles.heroSubtitle}>
          A school-wide directory of at-risk learners, broken down by section
          and risk factor, with a heatmap to spot where to focus first.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <StudentsCarousel />
      </div>
    </div>
  );
}
