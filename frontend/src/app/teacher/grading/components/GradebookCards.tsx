"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  ClassAverageRow,
  SubjectAssessmentRow,
  TeacherClassRow,
} from "../../overview/components/teacher-overview-data";
import styles from "./GradebookCards.module.css";

type Props = {
  classes: TeacherClassRow[];
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
};

export function GradebookCards({ classes, assessments, standings }: Props) {
  if (classes.length === 0) {
    return (
      <p className={styles.empty}>
        No classes assigned yet — ask your registrar to assign your subjects and sections first.
      </p>
    );
  }

  return (
    <div className={styles.grid}>
      {classes.map((c) => {
        const assessmentCount = assessments.filter(
          (a) => a.subject === c.subject && a.section === c.section
        ).length;
        const standing =
          standings.find((s) => s.subject === c.subject && s.section === c.section) ?? null;
        const pct =
          standing && standing.students > 0
            ? Math.round((standing.assessed / standing.students) * 100)
            : 0;
        return (
          <article key={c.id} className={styles.card} aria-label={`${c.subject} · ${c.section}`}>
            <div className={styles.cardBody}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardSubject}>{c.subject}</h2>
                <span className={styles.cardMeta}>
                  {c.section} · {c.gradeLevel}
                </span>
              </div>

              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{c.studentCount}</span>
                  <span className={styles.statLabel}>Students</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{assessmentCount}</span>
                  <span className={styles.statLabel}>Assessments</span>
                </div>
              </div>

              <div
                className={styles.progress}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${standing?.assessed ?? 0} of ${standing?.students ?? c.studentCount} assessed`}
              >
                <div className={styles.progressBar} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.progressLabel}>
                {standing?.assessed ?? 0} of {standing?.students ?? c.studentCount} assessed
              </span>

              <div className={styles.cardFoot}>
                <Button asChild className={styles.openBtn}>
                  <Link href={`/teacher/grading/${c.id}`}>Open workspace</Link>
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
