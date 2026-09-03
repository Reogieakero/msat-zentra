"use client";

import * as React from "react";
import {
  GraduationCap,
  BookOpen,
  LayoutGrid,
  UserRound,
  CalendarRange,
  ClipboardCheck,
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
    icon: BookOpen,
    title: "Subjects",
    body: "Maintain the G7–10 subject catalog for every track and strand.",
  },
  {
    icon: LayoutGrid,
    title: "Sections",
    body: "Configure class sections and their grade level, track, and advisers.",
  },
  {
    icon: UserRound,
    title: "Teacher Assignments",
    body: "Assign subject teachers to each section per term.",
  },
  {
    icon: CalendarRange,
    title: "Terms",
    body: "Keep subject-to-section coverage aligned with the active term.",
  },
  {
    icon: ClipboardCheck,
    title: "Coverage",
    body: "Spot-check that every section has its subjects and teachers allocated.",
  },
  {
    icon: GraduationCap,
    title: "Academic Catalog",
    body: "Manage the building blocks behind grades 7–10 report cards.",
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
        <h1 className={styles.heroTitle}>Sections &amp; Subjects</h1>
        <p className={styles.heroSubtitle}>
          Manage the G7–10 academic catalog — subjects, class sections, and
          teacher assignments that power the report cards.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <AcademicsCarousel />
      </div>
    </div>
  );
}
