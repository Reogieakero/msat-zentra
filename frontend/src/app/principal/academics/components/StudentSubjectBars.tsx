"use client";

import type { StudentRow } from "../academics-data";
import { SUBJECT_CODES } from "../academics-data";
import styles from "./StudentSubjectBars.module.css";

interface Props {
  student: StudentRow | null;
}

type Tier = "pass" | "partial" | "fail";

function tierFor(grade: number): Tier {
  if (grade > 80) return "pass";
  if (grade >= 75) return "partial";
  return "fail";
}

export function StudentSubjectBars({ student }: Props) {
  if (!student) return null;

  return (
    <div className={styles.barsWrap}>
      <p className={styles.barsTitle}>{student.name}</p>
      <p className={styles.barsSub}>Partial grade by subject (term)</p>
      <div className={styles.bars}>
        {student.subjects.map((sub) => {
          const tier = tierFor(sub.transmutedGrade);
          return (
            <div key={sub.subject} className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${
                    tier === "pass"
                      ? styles.barPass
                      : tier === "partial"
                        ? styles.barPartial
                        : styles.barFail
                  }`}
                  style={{ height: `${Math.max(4, sub.transmutedGrade)}%` }}
                />
              </div>
              <span className={styles.barCode} title={sub.subject}>
                {SUBJECT_CODES[sub.subject] ?? sub.subject}
              </span>
              <span className={styles.barVal}>{sub.transmutedGrade}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
