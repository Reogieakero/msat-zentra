"use client";

import { BookOpen } from "lucide-react";
import { KanbanSquare } from "lucide-react";
import boardStyles from "../../list/components/advisory-insight-board.module.css";
import type { AdviseeRow } from "@/services/teacher/advisory.types";

export interface GradeSubject {
  name: string;
  code: string;
}

export function gradeOf(student: AdviseeRow, subject: string): number | null {
  const g = (student.liveGrades ?? []).find((x) => x.subject === subject);
  return g ? g.average : null;
}

export function generalAverageOf(
  student: AdviseeRow,
  subjects: { name: string }[],
): number | null {
  const values: number[] = [];
  for (const s of subjects) {
    const v = gradeOf(student, s.name);
    if (v !== null) values.push(v);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function academicRiskOf(
  student: AdviseeRow,
  subjects: { name: string }[],
): "Low" | "Moderate" | null {
  const average = generalAverageOf(student, subjects);
  if (average === null) return null;
  return average < 75 ? "Moderate" : "Low";
}

export function AdvisoryGradesBoard({
  student,
  subjects,
  bare = false,
}: {
  student: AdviseeRow | null;
  subjects: GradeSubject[];
  bare?: boolean;
}) {
  if (!student) {
    return (
      <div
        className={`${boardStyles.board} ${bare ? boardStyles.bare : ""}`}
        aria-label="Student grades"
      >
        <header className={boardStyles.boardHead}>
          <span className={boardStyles.boardIcon} aria-hidden>
            <KanbanSquare size={18} />
          </span>
          <div className="min-w-0">
            <h2 className={boardStyles.boardTitle}>Student grades</h2>
            <p className={boardStyles.boardSub}>Select a row on the left to inspect</p>
          </div>
        </header>
        <p className={boardStyles.empty}>No student selected.</p>
      </div>
    );
  }

  const average = generalAverageOf(student, subjects);
  const risk = academicRiskOf(student, subjects);
  const gradedCount = subjects.filter((s) => gradeOf(student, s.name) !== null).length;

  return (
    <div
      className={`${boardStyles.board} ${bare ? boardStyles.bare : ""}`}
      aria-label={`Grades for ${student.name}`}
    >
      <header className={boardStyles.boardHead}>
        <span className={boardStyles.boardIcon} aria-hidden>
          <BookOpen size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={boardStyles.boardTitle}>Student grades</h2>
          <span className="mt-1 flex max-w-full flex-wrap items-center gap-1">
            <span className={boardStyles.headPill}>
              {average === null ? "No grades yet" : `Gen avg ${average.toFixed(1)}`}
            </span>
            <span className={boardStyles.headPill}>
              {`${gradedCount} of ${subjects.length} graded`}
            </span>
            <span
              className={
                risk === "Low"
                  ? `${boardStyles.kPill} ${boardStyles.kPillGreen}`
                  : boardStyles.kPill
              }
            >
              {risk === null ? "No data" : `${risk} risk`}
            </span>
          </span>
        </div>
      </header>

      <section className={boardStyles.plainSection} aria-label="Live average per subject">
        <header className={boardStyles.laneHead}>
          <span
            className={boardStyles.laneDot}
            style={{
              background:
                risk === "Low" ? "#22c55e" : risk === "Moderate" ? "#f59e0b" : "#f59e0b",
            }}
            aria-hidden
          />
          <h3 className={boardStyles.laneTitle}>Live average per subject</h3>
          <span className={boardStyles.laneCount}>{subjects.length}</span>
        </header>
        {subjects.length === 0 ? (
          <p className={boardStyles.empty}>No subjects linked to this section yet.</p>
        ) : (
          <ul className={boardStyles.cardGrid} key={student.studentId}>
            {subjects.map((subject) => {
              const value = gradeOf(student, subject.name);
              const connected = value !== null;
              return (
                <li
                  key={subject.name}
                  className={boardStyles.kCard}
                  aria-label={
                    connected
                      ? `${subject.name} live average ${value.toFixed(1)}`
                      : `${subject.name}: not connected`
                  }
                >
                  <div className={boardStyles.kTop}>
                    <span className={boardStyles.kPill} title={subject.name}>
                      {subject.code}
                    </span>
                    <span className={boardStyles.kCircle} aria-hidden>
                      <BookOpen size={14} />
                    </span>
                  </div>
                  <p className={boardStyles.kLabel}>Live average</p>
                  <div className={boardStyles.kBottom}>
                    <p className={boardStyles.kTitle} title={subject.name}>
                      {subject.name}
                    </p>
                    <p
                      className={`${boardStyles.kBig} ${connected ? "" : "text-muted-foreground"}`}
                    >
                      {connected ? (
                        <>
                          {value.toFixed(1)}
                          <span className={boardStyles.kUnit}>avg</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <p className={boardStyles.cardMeta}>
                    {connected
                      ? "Live average of recorded scores"
                      : "Not connected — no grade data from the subject teacher yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
