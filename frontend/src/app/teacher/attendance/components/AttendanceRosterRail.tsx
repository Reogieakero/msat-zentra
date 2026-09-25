"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSheetContext,
  fetchSheetMarks,
  initialsOf,
  type SheetSession,
  type SheetStatus,
} from "./attendance-taking-data";
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
  session: SheetSession;
}

/* Narrow roster rail for the attendance sheet: section summary plus a
   clickable class list that scrolls to the student's marking row and
   flashes it. Reads the same cached queries as the sheet, so it never
   fires duplicate requests. Status dots reflect submitted marks. */
export function AttendanceRosterRail({ date, session }: AttendanceRosterRailProps) {
  const contextQuery = useQuery({
    queryKey: ["attendance-sheet-context"],
    queryFn: fetchSheetContext,
    retry: false,
  });
  const marksQuery = useQuery({
    queryKey: ["attendance-sheet-marks", date, session],
    queryFn: () => fetchSheetMarks(`${date}T00:00:00Z`, session),
  });

  const students = React.useMemo(
    () => contextQuery.data?.students ?? [],
    [contextQuery.data]
  );
  const serverMarks = React.useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const loading = contextQuery.isPending || marksQuery.isPending;
  const [needle, setNeedle] = React.useState("");

  const visibleStudents = React.useMemo(() => {
    const q = needle.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q)
    );
  }, [students, needle]);

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

  const sessionLabel = session === "AM" ? "Morning" : "Afternoon";

  return (
    <aside className={styles.rail} aria-label="Class roster">
      <div className={styles.summary}>
        {loading ? (
          <>
            <Skeleton className={styles.skelSection} />
            <Skeleton className={styles.skelMeta} />
          </>
        ) : (
          <>
            <p className={styles.section}>{contextQuery.data?.sectionName ?? "Advisory"}</p>
            <p className={styles.meta}>
              {students.length} student{students.length === 1 ? "" : "s"} · {sessionLabel}
            </p>
          </>
        )}
      </div>

      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student…"
          value={needle}
          onChange={(e) => setNeedle(e.target.value)}
          aria-label="Search class list"
        />
      </div>

      {loading ? (
        <ul className={styles.list} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className={styles.skelItem}>
              <Skeleton className={styles.skelAvatar} />
              <Skeleton className={styles.skelName} />
            </li>
          ))}
        </ul>
      ) : visibleStudents.length === 0 ? (
        <p className={styles.empty}>
          {needle.trim() ? `No students match "${needle.trim()}".` : "No students."}
        </p>
      ) : (
        <ul className={styles.list}>
          {visibleStudents.map((s) => {
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
