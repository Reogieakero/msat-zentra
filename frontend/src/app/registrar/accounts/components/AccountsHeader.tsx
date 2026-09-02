"use client";

import * as React from "react";
import {
  UserCheck,
  UserPlus,
  ShieldCheck,
  Fingerprint,
  Users,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./AccountsHeader.module.css";

type Slide = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: UserPlus,
    title: "Pending Approvals",
    body: "Review student accounts awaiting registrar sign-off.",
  },
  {
    icon: UserCheck,
    title: "Approve Accounts",
    body: "Activate verified student logins so they can sign in.",
  },
  {
    icon: Fingerprint,
    title: "LRN Verification",
    body: "Confirm learner reference numbers against the roster.",
  },
  {
    icon: ShieldCheck,
    title: "Role & Access",
    body: "Control which learners and staff can access the portal.",
  },
  {
    icon: Users,
    title: "Accounts by Section",
    body: "See account coverage across every G11–12 section.",
  },
  {
    icon: KeyRound,
    title: "Credentials",
    body: "Keep student credentials organized and up to date.",
  },
];

function AccountsCarousel() {
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

export function AccountsHeader() {
  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Account Approvals</h1>
        <p className={styles.heroSubtitle}>
          Manage G11–12 student and staff account access — approve pending
          sign-ups, verify LRNs, and keep credentials in order.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <AccountsCarousel />
      </div>
    </div>
  );
}
