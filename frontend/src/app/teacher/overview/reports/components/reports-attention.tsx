"use client";

import { Flag, LockOpen, FileWarning } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import type {
  TeacherReportClassRow,
  TeacherReportPendingRow,
  TeacherReportsPayload,
} from "@/services/teacher/reports.types";
import { formatDate } from "./reports-format";
import styles from "./reports.module.css";

export function ReportsAttention({
  pending,
  classes,
  summary,
}: {
  pending: TeacherReportPendingRow[];
  classes: TeacherReportClassRow[];
  summary: TeacherReportsPayload["summary"];
}) {
  const unlocked = classes.filter(
    (c) => c.lockStatus === "unlocked" || c.lockStatus === null,
  ).length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h2 className={styles.cardTitle}>Needs attention</h2>
          <p className={styles.cardSub}>Work that is still open before the term closes.</p>
        </div>
      </div>

      <div className={styles.listRow}>
        <span className={styles.listRowMain}>
          <strong>
            <FileWarning size={13} aria-hidden /> {pending.length} assessment
            {pending.length === 1 ? "" : "s"} not fully scored
          </strong>
          <span className={styles.listRowMeta}>
            {summary.gradedAssessments}/{summary.assessments} assessments complete
          </span>
        </span>
      </div>
      <div className={styles.listRow}>
        <span className={styles.listRowMain}>
          <strong>
            <LockOpen size={13} aria-hidden /> {unlocked} class
            {unlocked === 1 ? "" : "es"} without locked finals
          </strong>
          <span className={styles.listRowMeta}>Lock finals, then submit for adviser approval.</span>
        </span>
      </div>
      <div className={styles.listRow}>
        <span className={styles.listRowMain}>
          <strong>
            <Flag size={13} aria-hidden /> {summary.openFlags} open grade flag
            {summary.openFlags === 1 ? "" : "s"}
          </strong>
          <span className={styles.listRowMeta}>Raised by you or owned by your gradebook.</span>
        </span>
      </div>

      {pending.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Assessment</th>
                <th scope="col">Type</th>
                <th scope="col">Given</th>
                <th scope="col" className={styles.num}>Scored</th>
              </tr>
            </thead>
            <tbody>
              {pending.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={styles.classCell}>
                      <span className={styles.className}>{row.title}</span>
                      <span className={styles.classMeta}>
                        {row.subject} · {row.section}
                      </span>
                    </span>
                  </td>
                  <td>
                    <Pill tone="neutral">{row.type}</Pill>
                  </td>
                  <td>{formatDate(row.dateGiven)}</td>
                  <td className={styles.num}>
                    {row.scored}/{row.learners}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length > 8 ? (
            <p className={styles.cardSub}>+{pending.length - 8} more not shown.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
