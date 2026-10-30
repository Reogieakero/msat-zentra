"use client";

import { GraduationCap } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import type { FinalsLockStatus, TeacherReportClassRow } from "@/services/teacher/reports.types";
import { formatGrade, formatPercent, LOCK_LABELS } from "./reports-format";
import styles from "./reports.module.css";

function lockTone(status: FinalsLockStatus) {
  if (status === "adviser_approved") return "green" as const;
  if (status === "locked") return "blue" as const;
  return "amber" as const;
}

/**
 * Class performance as a kanban board data table: the shared KanbanBoard shell
 * wraps a left-aligned table, and every cell value is a shared pill with a
 * field-name tooltip so the columns explain themselves.
 */
export function ReportsClassTable({ rows }: { rows: TeacherReportClassRow[] }) {
  return (
    <KanbanBoard
      title="Class performance"
      icon={
        <span className="text-primary" aria-hidden>
          <GraduationCap size={14} />
        </span>
      }
      description="Completion, averages, attendance, and finals state for every class you handle this term."
      ariaLabel="Class performance"
    >
      {rows.length === 0 ? (
        <p className={styles.empty}>No classes in this term yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Your role</th>
                <th scope="col">Learners</th>
                <th scope="col">Assessments</th>
                <th scope="col">Average</th>
                <th scope="col">Pass rate</th>
                <th scope="col">Attendance</th>
                <th scope="col">&lt; 80%</th>
                <th scope="col">Finals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={styles.classCell}>
                      <span className={styles.classNameRow}>
                        <span className={styles.className}>{row.subject}</span>
                        <Pill tone="blue" label="Subject code">
                          {row.subjectCode}
                        </Pill>
                      </span>
                      <span className={styles.chips}>
                        <Pill tone="amber" label="Section">
                          {row.section}
                        </Pill>
                        <Pill tone="neutral" label="Grade level">
                          {row.gradeLevel}
                        </Pill>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Pill
                      tone={row.teacherRole === "adviser" ? "violet" : "teal"}
                      label="Your role in this section"
                    >
                      {row.teacherRole === "adviser" ? "Adviser" : "Subject teacher"}
                    </Pill>
                  </td>
                  <td>
                    <Pill tone="neutral" label="Learners">
                      {row.learners}
                    </Pill>
                  </td>
                  <td>
                    <span className={styles.chips}>
                      <Pill tone="neutral" label="Assessments fully scored">
                        {row.gradedAssessments}/{row.assessments}
                      </Pill>
                      <Pill
                        tone={row.completionRate != null && row.completionRate >= 1 ? "green" : "amber"}
                        label="Assessment completion"
                      >
                        {formatPercent(row.completionRate)}
                      </Pill>
                    </span>
                  </td>
                  <td>
                    <Pill
                      tone={
                        row.transmutedAverage == null
                          ? "neutral"
                          : row.transmutedAverage < 75
                            ? "red"
                            : row.transmutedAverage < 80
                              ? "amber"
                              : "green"
                      }
                      label="Transmuted average"
                    >
                      {formatGrade(row.transmutedAverage, 1)}
                    </Pill>
                  </td>
                  <td>
                    <span className={styles.chips}>
                      <Pill
                        tone={
                          row.passRate == null
                            ? "neutral"
                            : row.passRate >= 0.75
                              ? "green"
                              : row.passRate > 0
                                ? "amber"
                                : "red"
                        }
                        label="Pass rate"
                      >
                        {formatPercent(row.passRate)}
                      </Pill>
                      <Pill tone="neutral" label="Passing learners">
                        {row.passing}/{row.passing + row.failing}
                      </Pill>
                    </span>
                  </td>
                  <td>
                    <Pill
                      tone={
                        row.attendanceRate == null
                          ? "neutral"
                          : row.attendanceRate < 0.8
                            ? "red"
                            : "green"
                      }
                      label="Attendance rate"
                    >
                      {formatPercent(row.attendanceRate)}
                    </Pill>
                  </td>
                  <td>
                    <Pill
                      tone={row.belowAttendance > 0 ? "red" : "green"}
                      label="Learners below 80% attendance"
                    >
                      {row.belowAttendance}
                    </Pill>
                  </td>
                  <td>
                    {row.lockStatus ? (
                      <Pill tone={lockTone(row.lockStatus)} label="Finals status">
                        {LOCK_LABELS[row.lockStatus] ?? row.lockStatus}
                      </Pill>
                    ) : (
                      <Pill tone="neutral" label="Finals status">
                        No finals
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </KanbanBoard>
  );
}
