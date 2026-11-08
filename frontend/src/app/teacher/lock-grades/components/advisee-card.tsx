"use client";

import * as React from "react";
import { Pill, type PillTone } from "@/components/ui/pill";
import type {
  LockGradesAdviseeRow,
  LockGradesSubjectRow,
} from "@/services/teacher/lockGrades.service";
import styles from "./lock-grades.module.css";

const statusLabel: Record<string, string> = {
  unlocked: "Unlocked",
  locked: "Locked",
  adviser_approved: "Adviser approved",
};

function statusTone(status: string | null | undefined): PillTone {
  if (status === "adviser_approved") return "green";
  if (status === "locked") return "amber";
  if (status === "unlocked") return "sky";
  return "neutral";
}

function subjectStatus(row: LockGradesSubjectRow): string {
  if (row.hiddenByTeacher) return "Hidden";
  if (row.lockStatus) return statusLabel[row.lockStatus] ?? row.lockStatus;
  if (row.computedAverage != null) return "Not locked";
  return "No grade";
}

function subjectTone(row: LockGradesSubjectRow): PillTone {
  if (row.hiddenByTeacher) return "neutral";
  return statusTone(row.lockStatus);
}

export function LockGradesAdviseeCard({ row }: { row: LockGradesAdviseeRow }) {
  return (
    <article className={styles.card} aria-label={row.name}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h3 className={styles.cardTitle}>{row.name}</h3>
          <p className={styles.cardMeta}>{row.section || "No section"}</p>
        </div>
        <Pill tone="neutral" label="LRN">
          {row.lrn || "—"}
        </Pill>
      </div>

      <div className={styles.pills}>
        <Pill tone="blue" label="Subjects">
          {row.summary.subjects} subject{row.summary.subjects === 1 ? "" : "s"}
        </Pill>
        <Pill tone="sky" label="With computed grade">
          {row.summary.graded} graded
        </Pill>
        <Pill tone="amber" label="Locked, awaiting approval">
          {row.summary.locked} locked
        </Pill>
        <Pill tone="green" label="Adviser approved">
          {row.summary.approved} approved
        </Pill>
        {!row.hasAccount ? (
          <Pill tone="neutral" label="Account">
            Roster only
          </Pill>
        ) : null}
      </div>

      <div role="table" aria-label={`${row.name} subject lock statuses`}>
        {row.subjects.length === 0 ? (
          <p className={`${styles.muted} ${styles.center}`}>No subjects on this section yet.</p>
        ) : (
          row.subjects.map((subject) => (
            <div key={subject.subjectId} className={styles.subjectRow} role="row">
              <span className={styles.subjectName} title={subject.subject} role="cell">
                {subject.subject}
              </span>
              <span className={`${styles.num} ${styles.muted}`} role="cell">
                {subject.hiddenByTeacher
                  ? "—"
                  : subject.computedAverage != null
                    ? subject.computedAverage.toFixed(2)
                    : "—"}
              </span>
              <span className={styles.num} role="cell">
                {subject.hiddenByTeacher
                  ? "—"
                  : subject.transmutedGrade != null
                    ? subject.transmutedGrade
                    : "—"}
              </span>
              <span className={styles.pills} role="cell">
                <Pill tone={subjectTone(subject)} label="Lock status">
                  {subjectStatus(subject)}
                </Pill>
              </span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
