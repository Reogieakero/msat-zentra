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
import type { StudentRow } from "../mockData";
import styles from "./GradeBreakdownDrawer.module.css";
import shared from "../academics.module.css";

interface Props {
  student: StudentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WEIGHTS = "Written Work 20% · Performance Task 40% · Quarterly Exam 40%";

export function GradeBreakdownDrawer({ student, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        {student && (
          <>
            <SheetHeader>
              <SheetTitle>{student.name}</SheetTitle>
              <SheetDescription>
                LRN {student.lrn} · Partial grade standing (view-only, not yet finalized)
              </SheetDescription>
            </SheetHeader>
            <div className={styles.drawerSection}>
              <div className={styles.drawerMeta}>
                <p className={styles.drawerSub}>
                  Risk level: <RiskBadge level={student.riskLevel} />
                </p>
                <p className={styles.drawerSub}>
                  Attendance: {student.attendanceRatePct.toFixed(1)}%
                </p>
              </div>

              <div className={styles.statGrid}>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Overall Avg</p>
                  <p className={styles.statValue}>{student.overallAverage.toFixed(1)}</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Subjects</p>
                  <p className={styles.statValue}>{student.subjects.length}</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statLabel}>Failed</p>
                  <p className={styles.statValue}>
                    {student.subjects.filter((s) => s.remarks === "Failed").length}
                  </p>
                </div>
              </div>

              <div>
                <p className={styles.weights}>
                  {WEIGHTS} · Partial grades (not locked/final)
                </p>
                <div className={shared.tableWrap} style={{ marginTop: "0.5rem" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={shared.stickyHead}>
                        <th className="p-2 text-left font-medium">Subject</th>
                        <th className="p-2 text-right font-medium">Partial Grade</th>
                        <th className="p-2 text-right font-medium">Standing</th>
                        <th className="p-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.subjects.map((s) => (
                        <tr key={s.subject} className="border-b">
                          <td className="p-2">{s.subject}</td>
                          <td className={`p-2 text-right ${shared.mono}`}>
                            {s.computedAverage.toFixed(1)}
                          </td>
                          <td className={`p-2 text-right ${shared.mono}`}>
                            {s.transmutedGrade}
                          </td>
                          <td className={`p-2 text-right ${shared.mono}`}>
                            {s.transmutedGrade > 80
                              ? "On track"
                              : s.transmutedGrade >= 75
                                ? "At risk"
                                : "Low"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
