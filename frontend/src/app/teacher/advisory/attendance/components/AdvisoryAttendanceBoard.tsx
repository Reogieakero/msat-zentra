"use client";

import { BookOpen, CalendarClock, KanbanSquare } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import boardStyles from "../../list/components/advisory-insight-board.module.css";

export interface AttendanceMatrixSubject {
  id: string;
  name: string;
  code: string;
}

export interface AttendanceMatrixStudent {
  studentId: string;
  name: string;
  lrn: string;
  /** Persisted sprite mascot (StudentMascot pool); null falls back to the derived one. */
  mascot: string | null;
  rates: Record<string, number | null>;
}

/** Mean present rate across subjects that actually have marks. */
export function attendanceOverall(
  rates: Record<string, number | null>,
  subjectCount: number,
): number {
  if (subjectCount === 0) return 0;
  const values = Object.values(rates).filter(
    (r): r is number => typeof r === "number" && Number.isFinite(r),
  );
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function attendanceRateClass(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= 0.75) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}

function attendanceBarClass(rate: number): string {
  if (rate >= 0.9) return "bg-green-500";
  if (rate >= 0.75) return "bg-amber-500";
  return "bg-red-500";
}

function attendanceDot(rate: number): string {
  if (rate >= 0.9) return "#22c55e";
  if (rate >= 0.75) return "#f59e0b";
  return "#ef4444";
}

/**
 * Right-side attendance board. Same kanban look as the advisory list's
 * Student insight board: amber header pills, a plain section with an
 * uppercase lane head, and a 4-per-row card grid of subject lanes.
 */
export function AdvisoryAttendanceBoard({
  student,
  subjects,
  bare = false,
}: {
  student: AttendanceMatrixStudent | null;
  subjects: AttendanceMatrixSubject[];
  bare?: boolean;
}) {
  if (!student) {
    return (
      <div
        className={`${boardStyles.board} ${bare ? boardStyles.bare : ""}`}
        aria-label="Student attendance"
      >
        <header className={boardStyles.boardHead}>
          <span className={boardStyles.boardIcon} aria-hidden>
            <KanbanSquare size={18} />
          </span>
          <div className="min-w-0">
            <h2 className={boardStyles.boardTitle}>Student attendance</h2>
            <p className={boardStyles.boardSub}>Select a row on the left to inspect</p>
          </div>
        </header>
        <p className={boardStyles.empty}>No student selected.</p>
      </div>
    );
  }

  const overall = attendanceOverall(student.rates, subjects.length);
  const overallPct = Math.round(overall * 100);
  const hasMarks = subjects.some(
    (s) => typeof student.rates[s.id] === "number",
  );
  const atRisk = hasMarks && overall < 0.75;

  return (
    <div
      className={`${boardStyles.board} ${bare ? boardStyles.bare : ""}`}
      aria-label={`Attendance for ${student.name}`}
    >
      <header className={boardStyles.boardHead}>
        <span className={boardStyles.boardIcon} aria-hidden>
          <CalendarClock size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={boardStyles.boardTitle}>Student attendance</h2>
          <span className="mt-1 flex max-w-full flex-wrap items-center gap-1">
            <Pill tone="amber" label="Overall present rate">
              {hasMarks ? `${overallPct}% overall` : "No marks yet"}
            </Pill>
            <Pill tone="amber" label="Subjects measured">
              {`${subjects.length} subject${subjects.length === 1 ? "" : "s"}`}
            </Pill>
            <Pill
              tone={!hasMarks ? "neutral" : atRisk ? "red" : "green"}
              label="Attendance status"
            >
              {!hasMarks ? "No data" : atRisk ? "At risk" : "On track"}
            </Pill>
          </span>
        </div>
      </header>

      <section className={boardStyles.plainSection} aria-label="Present rate per subject">
        <header className={boardStyles.laneHead}>
          <span
            className={boardStyles.laneDot}
            style={{ background: hasMarks ? attendanceDot(overall) : "#f59e0b" }}
            aria-hidden
          />
          <h3 className={boardStyles.laneTitle}>Present rate per subject</h3>
        </header>
        {subjects.length === 0 ? (
          <p className={boardStyles.empty}>No subjects linked to this section yet.</p>
        ) : (
          <ul className={boardStyles.cardGrid} key={student.studentId}>
            {subjects.map((subject) => {
              const rate = student.rates[subject.id] ?? null;
              const pct = rate === null ? null : Math.round(rate * 100);
              return (
                <li key={subject.id} className="min-w-0">
                  <section
                    className={boardStyles.lane}
                    aria-label={`${subject.name} attendance lane`}
                  >
                    <header className={boardStyles.colHead}>
                      <span className={boardStyles.colIcon} aria-hidden>
                        <BookOpen size={18} />
                      </span>
                      <h4 className={boardStyles.colTitle} title={subject.name}>
                        {subject.name}
                      </h4>
                      <Pill
                        tone={
                          rate === null
                            ? "neutral"
                            : rate >= 0.9
                              ? "green"
                              : rate < 0.75
                                ? "red"
                                : "amber"
                        }
                        label="Subject code"
                      >
                        {subject.code}
                      </Pill>
                    </header>
                    <ul className={boardStyles.laneBody}>
                      <li
                        className={boardStyles.kCard}
                        aria-label={
                          pct === null
                            ? `${subject.name} has no attendance marks yet`
                            : `${subject.name} present rate ${pct} percent`
                        }
                      >
                        <p className={boardStyles.kLabel}>Present rate</p>
                        <div className={boardStyles.kBottom}>
                          <p className={boardStyles.kTitle}>
                            {pct === null ? "No marks yet" : "Overall for this subject"}
                          </p>
                          <p className={`${boardStyles.kBig} ${attendanceRateClass(rate)}`}>
                            {pct === null ? (
                              "—"
                            ) : (
                              <>
                                {pct}
                                <span className={boardStyles.kUnit}>%</span>
                              </>
                            )}
                          </p>
                        </div>
                        {rate === null ? null : (
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={pct ?? 0}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${subject.name} present average`}
                          >
                            <div
                              className={`h-full rounded-full ${attendanceBarClass(rate)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </li>
                    </ul>
                  </section>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
