"use client";

import * as React from "react";
import {
  ShieldQuestion,
  ShieldCheck,
  FileKey,
  UserCheck,
  MessagesSquare,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./AdviserAccessHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: ShieldQuestion,
    title: "Access Requests",
    body: "Advisers request SF10 read access for their grade 11–12 advisees.",
  },
  {
    icon: FileKey,
    title: "Review Details",
    body: "Confirm the adviser, section, and scope before granting access.",
  },
  {
    icon: UserCheck,
    title: "Approve Access",
    body: "Approve valid requests so advisers can view their advisees' records.",
  },
  {
    icon: ShieldCheck,
    title: "Deny & Reason",
    body: "Deny requests with a clear reason when they fall outside the band.",
  },
  {
    icon: MessagesSquare,
    title: "Notify Adviser",
    body: "The requesting adviser is notified automatically of each decision.",
  },
  {
    icon: Clock3,
    title: "Track History",
    body: "Keep a running record of every access decision for accountability.",
  },
];

function AdviserCarousel() {
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

export function AdviserAccessHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Adviser SF10 Access</h1>
        <p className={styles.heroSubtitle}>
          Review and decide Grade 11–12 adviser requests for SF10 read access —
          approve valid requests and keep every decision accountable.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <AdviserCarousel />
      </div>
    </div>
  );
}
