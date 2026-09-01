"use client";

import * as React from "react";
import {
  ShieldAlert,
  Flame,
  TrendingUp,
  Users,
  BarChart3,
  Target,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./RiskHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: ShieldAlert,
    title: "At-Risk Flags",
    body: "Track learners flagged across academic, attendance, and behavior factors.",
  },
  {
    icon: Flame,
    title: "High-Risk Students",
    body: "Surface the students that need priority review and intervention.",
  },
  {
    icon: BarChart3,
    title: "Risk Level Distribution",
    body: "See how low, moderate, and high-risk students break down per level.",
  },
  {
    icon: TrendingUp,
    title: "Risk Trend",
    body: "Monitor whether at-risk counts are rising or falling over time.",
  },
  {
    icon: Users,
    title: "Low-Risk Students",
    body: "Spot the students who are on track and no longer need follow-up.",
  },
  {
    icon: Target,
    title: "Intervention Tracking",
    body: "Keep an eye on intervention outcomes and early-warning actions.",
  },
];

function RiskCarousel() {
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

export function RiskHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Board Risk</h1>
        <p className={styles.heroSubtitle}>
          A school-wide view of at-risk learners, risk trends, and
          early-intervention tracking across every grade level and section.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <RiskCarousel />
      </div>
    </div>
  );
}
