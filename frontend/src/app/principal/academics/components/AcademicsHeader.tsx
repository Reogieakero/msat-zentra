"use client";

import * as React from "react";
import {
  GraduationCap,
  BookOpenCheck,
  Users,
  ShieldAlert,
  Award,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./AcademicsHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: GraduationCap,
    title: "Final vs Raw Grades",
    body: "Compare transmuted final grades against raw partial scores.",
  },
  {
    icon: BookOpenCheck,
    title: "School-wide Averages",
    body: "Review average grades by level and section.",
  },
  {
    icon: Users,
    title: "Class-level Insights",
    body: "Inspect per-student subject results and attendance.",
  },
  {
    icon: ShieldAlert,
    title: "Students at Risk",
    body: "Flag learners below the passing threshold.",
  },
  {
    icon: Award,
    title: "Honor Roll Preview",
    body: "Preview honor-roll candidates as the term closes.",
  },
];

function AcademicsCarousel() {
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

export function AcademicsHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Academic Performance</h1>
        <p className={styles.heroSubtitle}>
          A school-wide view of grading, honor roll, and at-risk performance
          across every grade level and section.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <AcademicsCarousel />
      </div>
    </div>
  );
}
