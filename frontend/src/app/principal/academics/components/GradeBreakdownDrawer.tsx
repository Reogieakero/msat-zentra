"use client";

import { CardModal } from "@/components/ui/CardModal";
import { RiskBadge } from "./RiskBadge";
import type { StudentRow } from "@/services/principal/academics";
import type { GradeMode } from "../../grade-mode-context";
import styles from "./GradeBreakdownDrawer.module.css";
import shared from "../academics.module.css";

interface Props {
  student: StudentRow | null;
  gradeMode: GradeMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GradeBreakdownDrawer({
  student,
  gradeMode,
  open,
  onOpenChange,
}: Props) {
  const showTransmuted = gradeMode === "final";
  return (
    <CardModal
      open={open}
      onClose={() => onOpenChange(false)}
      size="lg"
      title={student?.name ?? "Grade breakdown"}
      description={
        student
          ? `LRN ${student.lrn} · ${showTransmuted ? "Final grade breakdown" : "Raw partial grades"} (view-only, not yet finalized)`
          : undefined
      }
      watchKey={student?.studentId}
    >
      {student && (
          <>
            <div className={styles.drawerSection}>
              <div className={styles.metaRow}>
                <RiskBadge level={student.riskLevel} />
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <p className={styles.statValue}>{student.overallAverage.toFixed(1)}</p>
                  <p className={styles.statLabel}>Overall Average</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statValue}>{student.subjects.length}</p>
                  <p className={styles.statLabel}>Subjects</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statValue}>
                    {student.subjects.filter((s) => s.remarks === "Failed").length}
                  </p>
                  <p className={styles.statLabel}>Below Passing</p>
                </div>
              </div>

              <div className={styles.gradesBlock}>
                <div className={styles.gradesHead}>
                  <h4 className={styles.gradesTitle}>Subject Performance</h4>
                </div>
                <ul className={styles.barsList}>
                  {student.subjects.map((s) => {
                    const fail = s.transmutedGrade < 75;
                    return (
                      <li key={s.subject} className={styles.barRow}>
                        <span className={styles.barName} title={s.subject}>
                          {s.subject}
                        </span>
                        <span className={styles.barTrack}>
                          <span
                            className={`${styles.barFill} ${
                              fail ? styles.barFillFail : ""
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, s.transmutedGrade))}%` }}
                          />
                          <span className={styles.barMarker} aria-hidden />
                        </span>
                        <span
                          className={`${styles.barValue} ${
                            fail ? styles.barValueFail : ""
                          }`}
                          title={`Transmuted ${s.transmutedGrade}`}
                        >
                          {s.transmutedGrade}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className={styles.gradesBlock}>
                <div className={styles.gradesHead}>
                  <h4 className={styles.gradesTitle}>Subject Grades</h4>
                </div>
                <div className={shared.tableWrap}>
                  <table className={styles.gradesTable}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Subject</th>
                        <th className={`${styles.th} ${styles.thCenter}`}>Partial</th>
                        <th className={`${styles.th} ${styles.thCenter}`}>Transmuted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.subjects.map((s) => {
                        return (
                          <tr key={s.subject} className={styles.row}>
                            <td className={styles.td}>{s.subject}</td>
                            <td className={`${styles.td} ${styles.tdNum} ${styles.tdCenter}`}>
                              {s.computedAverage.toFixed(1)}
                            </td>
                            <td className={`${styles.td} ${styles.tdNum} ${styles.tdCenter}`}>
                              {s.transmutedGrade}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={styles.note}>
                  {showTransmuted
                    ? "Partial grades are transmuted to the final 0–100 scale (not yet locked or finalized)."
                    : "Showing raw partial grades only (transmutation hidden in raw mode)."}
                </p>
              </div>

              <div className={styles.weightCard}>
                <p className={styles.weightCardTitle}>Grade Component Weights</p>
                <ul className={styles.weightList}>
                  <li className={styles.weightItem}>
                    <span className={styles.weightName}>Written Work</span>
                    <span className={styles.weightPct}>20%</span>
                  </li>
                  <li className={styles.weightItem}>
                    <span className={styles.weightName}>Performance Task</span>
                    <span className={styles.weightPct}>40%</span>
                  </li>
                  <li className={styles.weightItem}>
                    <span className={styles.weightName}>Exam</span>
                    <span className={styles.weightPct}>40%</span>
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
    </CardModal>
  );
}
