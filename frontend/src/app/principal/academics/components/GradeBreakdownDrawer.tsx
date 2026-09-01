"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RiskBadge } from "./RiskBadge";
import type { StudentRow } from "../academics-data";
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
  const [attendanceSession, setAttendanceSession] = React.useState<"AM" | "PM">("AM");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={`${styles.sheet} sm:max-w-lg`}>
        {student && (
          <>
            <SheetHeader>
              <SheetTitle>{student.name}</SheetTitle>
              <SheetDescription>
                LRN {student.lrn} · {showTransmuted ? "Final grade breakdown" : "Raw partial grades"} (view-only, not yet finalized)
              </SheetDescription>
            </SheetHeader>
            <div className={styles.drawerSection}>
              <div className={styles.metaRow}>
                <span className={styles.metaPill}>
                  <RiskBadge level={student.riskLevel} />
                </span>
              </div>

              {(() => {
                const present =
                  attendanceSession === "AM" ? student.presentAm : student.presentPm;
                const total = student.schoolDays;
                const rate = total > 0 ? (present / total) * 100 : 0;
                const R = 26;
                const C = 2 * Math.PI * R;
                const dash = `${(rate / 100) * C} ${C}`;
                return (
                  <div className={styles.attendanceCard}>
                    <div className={styles.attendanceHead}>
                      <h4 className={styles.gradesTitle}>Attendance</h4>
                      <div className={styles.sessionTabs}>
                        {(["AM", "PM"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`${styles.sessionTab} ${
                              attendanceSession === s ? styles.sessionTabActive : ""
                            }`}
                            onClick={() => setAttendanceSession(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.attendanceBody}>
                      <svg
                        className={styles.donut}
                        viewBox="0 0 64 64"
                        role="img"
                        aria-label={`${attendanceSession} attendance ${present} of ${total} school days present`}
                      >
                        <circle
                          className={styles.donutTrack}
                          cx="32"
                          cy="32"
                          r={R}
                          fill="none"
                          strokeWidth="8"
                        />
                        <circle
                          className={styles.donutValue}
                          cx="32"
                          cy="32"
                          r={R}
                          fill="none"
                          strokeWidth="8"
                          strokeDasharray={dash}
                          strokeDashoffset={0}
                          transform="rotate(-90 32 32)"
                        />
                        <text
                          x="32"
                          y="32"
                          className={styles.donutCenter}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {present}
                          <tspan className={styles.donutCenterTotal}>/{total}</tspan>
                        </text>
                      </svg>
                      <div className={styles.attendanceReadout}>
                        <p className={styles.attendancePct}>
                          {present}
                          <span className={styles.attendanceTotal}>/{total}</span>
                        </p>
                        <p className={styles.attendanceDetail}>
                          {attendanceSession} present of {total} school days
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Overall Average</p>
                  <p className={styles.statValue}>{student.overallAverage.toFixed(1)}</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Subjects</p>
                  <p className={styles.statValue}>{student.subjects.length}</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Below Passing</p>
                  <p className={styles.statValue}>
                    {student.subjects.filter((s) => s.remarks === "Failed").length}
                  </p>
                </div>
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
                        {showTransmuted ? (
                          <th className={`${styles.th} ${styles.thCenter}`}>Transmuted</th>
                        ) : null}
                        <th className={`${styles.th} ${styles.thCenter}`}>Standing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.subjects.map((s) => {
                        const value = showTransmuted ? s.transmutedGrade : s.computedAverage;
                        const standing =
                          value > 80
                            ? "On track"
                            : value >= 75
                              ? "At risk"
                              : "Low";
                        const standingClass =
                          standing === "On track"
                            ? styles.standingGood
                            : standing === "At risk"
                              ? styles.standingWarn
                              : styles.standingLow;
                        return (
                          <tr key={s.subject} className={styles.row}>
                            <td className={styles.td}>{s.subject}</td>
                            <td className={`${styles.td} ${styles.tdNum} ${styles.tdCenter}`}>
                              {s.computedAverage.toFixed(1)}
                            </td>
                            {showTransmuted ? (
                              <td className={`${styles.td} ${styles.tdNum} ${styles.tdCenter}`}>
                                {s.transmutedGrade}
                              </td>
                            ) : null}
                            <td className={`${styles.td} ${styles.tdCenter}`}>
                              <span className={`${styles.standing} ${standingClass}`}>
                                {standing}
                              </span>
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
                    <span className={styles.weightName}>Quarterly Exam</span>
                    <span className={styles.weightPct}>40%</span>
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
