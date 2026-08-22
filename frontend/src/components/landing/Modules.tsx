"use client";

import * as React from "react";
import { GraduationCap, CalendarCheck, ShieldAlert, Lock } from "lucide-react";
import styles from "./Modules.module.css";

const modules = [
  {
    icon: GraduationCap,
    title: "Grading & Transmutation",
    body: "DepEd-weighted components, computed finals, and registrar validation.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance",
    body: "AM/PM sessions with term-rate computation and risk flags.",
  },
  {
    icon: ShieldAlert,
    title: "Early Intervention",
    body: "Rule-based risk detection across academic, attendance, and behavior.",
  },
  {
    icon: Lock,
    title: "Confidential by Design",
    body: "Tiered anecdotal, health, and ADM records with strict RBAC.",
  },
];

export function Modules() {
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <section id="modules" className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>What Zentra unifies</h2>
        <p className={styles.subhead}>
          One <em className={styles.emph}>system of record</em> for grades,
          attendance, and well-being — so the whole school reads the same truth
          and risk shows up early.
        </p>
        <div className={styles.grid}>
          {modules.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className={styles.card}
              onMouseMove={handleMove}
            >
              <span className={styles.icon}>
                <Icon size={20} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

