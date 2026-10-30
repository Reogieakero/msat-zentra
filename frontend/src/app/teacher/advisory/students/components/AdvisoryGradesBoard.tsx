"use client";

import { BookOpen, KanbanSquare } from "lucide-react";
import { Pill } from "@/components/ui/pill";
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

function gradeTone(value: number | null): "neutral" | "green" | "amber" | "red" {
  if (value === null) return "neutral";
  if (value >= 90) return "green";
  if (value >= 80) return "amber";
  return "red";
}

/**
 * Right-side grades board. Same kanban look as the advisory list's Student
 * insight board and the attendance board: amber header pills, a plain section
 * with an uppercase lane head, and a 4-per-row card grid of subject lanes.
 */
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
            <Pill tone="amber" label="General average">
              {average === null ? "No grades yet" : `Gen avg ${average.toFixed(1)}`}
            </Pill>
            <Pill tone="amber" label="Subjects graded">
              {`${gradedCount} of ${subjects.length} graded`}
            </Pill>
            <Pill
              tone={risk === null ? "neutral" : risk === "Low" ? "green" : "amber"}
              label="Academic risk"
            >
              {risk === null ? "No data" : `${risk} risk`}
            </Pill>
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
        </header>
        {subjects.length === 0 ? (
          <p className={boardStyles.empty}>No subjects linked to this section yet.</p>
        ) : (
          <ul className={boardStyles.cardGrid} key={student.studentId}>
            {subjects.map((subject) => {
              const value = gradeOf(student, subject.name);
              const connected = value !== null;
              return (
                <li key={subject.name} className="min-w-0">
                  <section
                    className={boardStyles.lane}
                    aria-label={`${subject.name} grade lane`}
                  >
                    <header className={boardStyles.colHead}>
                      <span className={boardStyles.colIcon} aria-hidden>
                        <BookOpen size={18} />
                      </span>
                      <h4 className={boardStyles.colTitle} title={subject.name}>
                        {subject.name}
                      </h4>
                      <Pill tone={gradeTone(value)} label="Subject code">
                        {subject.code}
                      </Pill>
                    </header>
                    <ul className={boardStyles.laneBody}>
                      <li
                        className={boardStyles.kCard}
                        aria-label={
                          connected
                            ? `${subject.name} live average ${value.toFixed(1)}`
                            : `${subject.name}: not connected`
                        }
                      >
                        <p className={boardStyles.kLabel}>Live average</p>
                        <div className={boardStyles.kBottom}>
                          <p className={boardStyles.kTitle}>
                            {connected ? "Overall for this subject" : "Not connected"}
                          </p>
                          <p
                            className={`${boardStyles.kBig} ${
                              connected ? "" : "text-muted-foreground"
                            }`}
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
                            : "No grade data shared by the subject teacher yet"}
                        </p>
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
