"use client";

import * as React from "react";
import {
  FileText,
  LayoutGrid,
  ShieldAlert,
  Clock,
  CircleDot,
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./RecordsHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: FileText,
    title: "Behavioral Records",
    body: "Per-student anecdotal records filed during the active term.",
  },
  {
    icon: LayoutGrid,
    title: "Category Heatblocks",
    body: "One block per tracked student, tinted by their dominant anecdotal category.",
  },
  {
    icon: ShieldAlert,
    title: "Severity Tracking",
    body: "High, Moderate, and Low severity flags for every incident on file.",
  },
  {
    icon: Clock,
    title: "Follow-ups & Resolution",
    body: "Monitor which records still need a follow-up and which stay unresolved.",
  },
  {
    icon: CircleDot,
    title: "Drill into a Student",
    body: "Select any block to open that learner's full behavioral timeline.",
  },
  {
    icon: TriangleAlert,
    title: "Needs Attention",
    body: "Surface the students carrying the heaviest record load this term.",
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

export function RecordsHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Records Heatmap</h1>
        <p className={styles.heroSubtitle}>
          A school-wide view of behavioral records across every grade and
          section — with category heatblocks, severity flags, follow-ups, and a
          drill-down into each learner&rsquo;s incident timeline.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <Carousel />
      </div>
    </div>
  );
}