"use client";

import * as React from "react";
import {
  BookOpen,
  TrendingUp,
  TriangleAlert,
  Gauge,
  GraduationCap,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./AcademicHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: BookOpen,
    title: "Section Performance",
    body: "Average transmuted grade per section, benchmarked against the 75% passing mark.",
  },
  {
    icon: Gauge,
    title: "Pass / Fail Split",
    body: "How many students pass or fail each grade level across the active term.",
  },
  {
    icon: GraduationCap,
    title: "Grade-level View",
    body: "Grouped performance by grade level to spot patterns across the school.",
  },
  {
    icon: TrendingUp,
    title: "Subject-Level Signals",
    body: "Identify subjects where learners are most often falling below passing.",
  },
  {
    icon: AlertTriangle,
    title: "Students Below 75",
    body: "Surface learners whose overall average sits under the passing mark.",
  },
  {
    icon: TriangleAlert,
    title: "At-Risk Sections",
    body: "Sections with at least one learner below 75, ready to drill into.",
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

export function AcademicHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Academic Heatmap</h1>
        <p className={styles.heroSubtitle}>
          A school-wide view of section &amp; subject performance across every
          grade — with pass/fail splits, at-risk learners, and a drill-down into
          students below the 75% passing mark.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <Carousel />
      </div>
    </div>
  );
}
