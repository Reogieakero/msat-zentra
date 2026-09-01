import * as React from "react";
import { X, CircleDot } from "lucide-react";
import type { RecordStudent } from "../types";
import styles from "../records.module.css";

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function severityTone(sev: "Low" | "Moderate" | "High"): string {
  return sev === "High" ? styles.sevHigh : sev === "Moderate" ? styles.sevModerate : styles.sevLow;
}

function followTone(f: "Pending" | "Resolved" | "Monitoring"): string {
  return f === "Resolved" ? styles.followResolved : f === "Monitoring" ? styles.followMonitoring : styles.followPending;
}

export function StudentInfoPanel({
  student,
  onClose,
}: {
  student: RecordStudent | null;
  onClose: () => void;
}) {
  return (
    <aside className={styles.panel} aria-label="Student information" aria-live="polite">
      {!student ? (
        <div className={styles.panelEmpty}>
          <CircleDot className={styles.panelEmptyIcon} aria-hidden />
          <p className={styles.panelEmptyText}>Select a student block to view their record.</p>
        </div>
      ) : (
        <div className={styles.panelScroll}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.studentName}>{student.name}</h2>
              <p className={styles.studentLrn}>{student.lrn}</p>
            </div>
            <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Clear selection">
              <X className={styles.panelCloseIcon} aria-hidden />
            </button>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.metaText}>
              {student.gradeLevel} · {student.section}
            </span>
          </div>

          <section className={styles.panelSection}>
            <h3 className={styles.blockTitle}>
              Behavioral Records <span className={styles.countBadge}>{student.behavioral.length}</span>
            </h3>
            {student.behavioral.length === 0 ? (
              <p className={styles.panelEmptyText}>No behavioral records on file.</p>
            ) : (
              <ol className={styles.timeline}>
                {student.behavioral.map((rec) => (
                  <li key={rec.id} className={styles.timelineItem}>
                    <div className={styles.timelineDot} aria-hidden />
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineTop}>
                        <span className={styles.timelineDate}>{rec.date}</span>
                        <span className={`${styles.sevTag} ${severityTone(rec.severity)}`}>{rec.severity}</span>
                      </div>
                      <p className={styles.timelineCat}>{titleCase(rec.category)}</p>
                      <p className={styles.timelineDesc}>{rec.description}</p>
                      <p className={styles.timelineNote}>
                        {rec.staff} · {titleCase(rec.resolution)}
                      </p>
                      <span className={`${styles.followTag} ${followTone(rec.followUp)}`}>{rec.followUp}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
