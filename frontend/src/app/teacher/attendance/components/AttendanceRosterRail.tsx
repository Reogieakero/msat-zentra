"use client";

import * as React from "react";
import {
  useSheetContext,
  useSheetMarks,
} from "@/services/teacher/attendance.service";
import { initialsOf } from "@/lib/utils";
import type {
  SheetContext,
  SheetStatus,
} from "@/services/teacher/attendance.types";
import { RosterRailListSkeleton } from "./attendance-skeleton";
import sheetStyles from "./AttendanceSheet.module.css";
import styles from "./AttendanceRosterRail.module.css";

const DOT_TITLES: Record<SheetStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

interface AttendanceRosterRailProps {
  date: string;
  subjectId: string | undefined;
  slot: number;
  /** Explicit section roster (code-claimed flow). When provided, the rail
   *  reads from it instead of the advisory context. */
  roster?: { ctx: SheetContext | null; pending: boolean; error: boolean };
}

/* Narrow roster rail for the attendance sheet: section summary plus a
   clickable class list that scrolls to the student's marking row and
   flashes it. Reads the same cached queries as the sheet, so it never
   fires duplicate requests. Status dots reflect submitted marks. */
export function AttendanceRosterRail({
  date,
  subjectId,
  slot,
  roster,
}: AttendanceRosterRailProps) {
  const contextQuery = useSheetContext();
  const effectiveCtx = roster ? roster.ctx : (contextQuery.data ?? null);
  const marksQuery = useSheetMarks(date, subjectId, slot, effectiveCtx?.sectionId ?? null);

  const students = React.useMemo(
    () => effectiveCtx?.students ?? [],
    [effectiveCtx]
  );
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const loading = (roster ? roster.pending : contextQuery.isPending) || marksQuery.isPending;

  function jumpTo(studentId: string) {
    const el = document.getElementById(`sheet-row-${studentId}`);
    if (!el) return;
    const smooth =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    el.classList.remove(sheetStyles.rowFlash);
    // Force reflow so repeat clicks retrigger the flash animation.
    void el.offsetWidth;
    el.classList.add(sheetStyles.rowFlash);
    window.setTimeout(() => el.classList.remove(sheetStyles.rowFlash), 1600);
  }

  return (
    <aside className={styles.rail} aria-label="Class roster">
      {loading ? (
        <RosterRailListSkeleton />
      ) : students.length === 0 ? (
        <p className={styles.empty}>No students.</p>
      ) : (
        <ul className={styles.list}>
          {students.map((s) => {
            const status: SheetStatus = serverMarks[s.studentId] ?? "present";
            const pct = Math.round(s.attendanceRate * 100);
            const band = s.attendanceRate >= 0.9 ? "good" : s.attendanceRate >= 0.75 ? "warn" : "bad";
            return (
              <li key={s.studentId}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => jumpTo(s.studentId)}
                  title={`${s.name} — ${pct}% attendance, ${DOT_TITLES[status]}`}
                >
                  <span className={styles.avatar} aria-hidden>
                    {initialsOf(s.name)}
                  </span>
                  <span className={styles.name}>{s.name}</span>
                  <span className={styles.rate} data-band={band}>
                    {pct}%
                  </span>
                  <span
                    className={styles.dot}
                    data-status={status}
                    title={DOT_TITLES[status]}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
