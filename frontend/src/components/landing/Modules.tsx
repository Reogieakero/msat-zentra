"use client";

import * as React from "react";
import {
  BarChart3,
  CalendarCheck,
  FileSearch,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  Route,
  ShieldAlert,
} from "lucide-react";
import { Reveal } from "./Reveal";
import shell from "./LandingPage.module.css";
import styles from "./Modules.module.css";

const modules = [
  {
    icon: GraduationCap,
    title: "Grading & transmutation",
    body: "DepEd-weighted components, computed finals, and a lock → adviser-approve flow for every section.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance",
    body: "AM/PM and per-subject sheets, auto-absent sweeps, and term-rate heatmaps by section and learner.",
  },
  {
    icon: FileSearch,
    title: "SF10 records",
    body: "OCR-assisted uploads, append-only versions, and verify → validate → release with banded desks.",
  },
  {
    icon: ShieldAlert,
    title: "Early intervention",
    body: "Low / Moderate / High risk detected live from grades, attendance, and behavioral signals.",
  },
  {
    icon: HeartHandshake,
    title: "Guidance & health",
    body: "Referrals, counseling sessions, clinic records, and follow-ups tracked to a recorded outcome.",
  },
  {
    icon: Route,
    title: "ADM cases",
    body: "Eight stages from consultation and home visitation to certification, principal sign-off, and completion.",
  },
  {
    icon: BarChart3,
    title: "Reports & heatmaps",
    body: "School-wide dashboards, honor roll, audit trail, and cached snapshots for heavy reporting days.",
  },
  {
    icon: LockKeyhole,
    title: "Confidential by design",
    body: "Tiered anecdotal, health, and ADM records with server-enforced RBAC and grade-band guards.",
  },
];

export function Modules() {
  const onMove = (event: React.MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    card.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(px * 5).toFixed(2)}deg`);
  };

  const onLeave = (event: React.MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };

  return (
    <section id="modules" className={`${shell.section} ${styles.section}`}>
      <div className={shell.sectionInner}>
        <Reveal as="header" className={styles.head}>
          <p className={shell.eyebrow}>
            <span className={shell.eyebrowDot} aria-hidden="true" />
            The system
          </p>
          <h2 className={shell.heading}>
            What Zentra <span className={shell.headingAccent}>unifies</span>
          </h2>
          <p className={shell.lead}>
            One system of record for grades, attendance, records, and well-being — so
            every desk reads the same truth and risk surfaces while there is still time
            to act.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {modules.map(({ icon: Icon, title, body }, index) => (
            <Reveal
              as="article"
              key={title}
              className={styles.card}
              style={{ ["--reveal-delay" as string]: `${80 + index * 55}ms` }}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            >
              <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.icon}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
