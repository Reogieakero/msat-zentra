"use client";

import * as React from "react";
import {
  TriangleAlert,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AdviseeRow } from "./advisory-students-data";
import styles from "./AdvisoryStudentsHeader.module.css";

interface AdvisoryStudentsHeaderProps {
  students: AdviseeRow[];
}

export function AdvisoryStudentsHeader({ students }: AdvisoryStudentsHeaderProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const highRisk = students.filter((s) => s.riskLevel === "High").length;
  const openFlags = students.filter((s) => s.hasOpenFlag).length;
  const lowAttendance = students.filter((s) => s.attendanceRate < 0.8).length;
  const withAnecdotal = students.filter((s) => s.anecdotalCount > 0).length;
  const sectionName = students[0]?.section ?? "";

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className={styles.hero}>
      <div className={`${styles.heroPanel} ${styles.heroPanelTitle}`}>
        <h1 className={styles.heroTitle}>Advisory Students</h1>
        <p className={styles.heroSubtitle}>
          Your advisees at a glance — status only, never private write-ups.
        </p>
      </div>

      <div className={`${styles.heroPanel} ${styles.heroPanelCarousel}`}>
        <div className={styles.carousel}>
          <div className={styles.scroller} ref={scrollerRef}>
            <div className={styles.row}>
              <article className={styles.card}>
                <div className={styles.heading}>
                  <TriangleAlert className={styles.icon} aria-hidden />
                  <h2 className={styles.title}>Needs Attention</h2>
                </div>
                <p className={styles.body}>
                  {highRisk} high-risk · {openFlags} open flags need follow-up.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.heading}>
                  <Clock className={styles.icon} aria-hidden />
                  <h2 className={styles.title}>Low Attendance</h2>
                </div>
                <p className={styles.body}>
                  {lowAttendance} advisees below 80% attendance{sectionName ? ` in ${sectionName}` : ""}.
                </p>
              </article>
              <article className={styles.card}>
                <div className={styles.heading}>
                  <FileText className={styles.icon} aria-hidden />
                  <h2 className={styles.title}>Anecdotal on File</h2>
                </div>
                <p className={styles.body}>
                  {withAnecdotal} of {students.length} advisees with anecdotal records.
                </p>
              </article>
            </div>
          </div>

          <div className={styles.nav}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll cards left"
            >
              <ChevronLeft className={styles.arrowIcon} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(1)}
              aria-label="Scroll cards right"
            >
              <ChevronRight className={styles.arrowIcon} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
