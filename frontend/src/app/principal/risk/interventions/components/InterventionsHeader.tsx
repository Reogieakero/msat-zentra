"use client";

import * as React from "react";
import {
  ShieldAlert,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./InterventionsHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: ShieldAlert,
    title: "Intervention Tracking",
    body: "Monitor early-intervention progress for at-risk students across all grade levels.",
  },
  {
    icon: Users,
    title: "Risk-Based Queue",
    body: "Students flagged by the risk engine, prioritized by severity and factor.",
  },
  {
    icon: Clock,
    title: "Approval Workflow",
    body: "Track pending approvals and intervention assignments to guidance counselors.",
  },
  {
    icon: CheckCircle2,
    title: "Outcome Monitoring",
    body: "Follow each intervention from assignment through resolution.",
  },
  {
    icon: AlertTriangle,
    title: "High-Risk Focus",
    body: "Surface High and Moderate risk students requiring immediate attention.",
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

export function InterventionsHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Interventions</h1>
        <p className={styles.heroSubtitle}>
          Early-intervention progress tracking for at-risk students —
          monitor approvals, assignments, and outcomes across every grade and
          section.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <Carousel />
      </div>
    </div>
  );
}
