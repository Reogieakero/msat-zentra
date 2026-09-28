"use client";

import {
  Users,
  LayoutDashboard,
  ShieldAlert,
  CalendarDays,
  FileSignature,
  GraduationCap,
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

export function OverviewHeader() {
  return (
    <aside className={styles.sidebar} aria-label="Overview highlights">
      {SLIDES.map((slide) => (
        <article key={slide.title} className={styles.card}>
          <div className={styles.heading}>
            <slide.icon className={styles.icon} aria-hidden />
            <h2 className={styles.title}>{slide.title}</h2>
          </div>
          <p className={styles.body}>{slide.body}</p>
          <slide.icon className={styles.watermark} aria-hidden />
        </article>
      ))}
    </aside>
  );
}
