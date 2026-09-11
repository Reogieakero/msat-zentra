"use client";

import * as React from "react";
import {
  COMPONENT_NAMES,
  bandForGrade,
  categoryWork,
  type ClassDetail,
} from "../../components/grading-data";
import { WeightsVisual } from "./WeightsVisual";
import styles from "./SolutionContent.module.css";

type Props = {
  detail: ClassDetail;
  studentId: string;
};

export function SolutionContent({ detail, studentId }: Props) {
  const student = detail.students.find((s) => s.id === studentId);
  const work = categoryWork(detail.components, studentId);
  const computed = work.reduce((s, w) => s + w.contribution, 0);
  const band = bandForGrade(computed);
  const remarks = band.grade >= 75 ? "Passed" : "Failed";
  const hasScores = work.some((w) => w.parts.length > 0);
  const fmt = (n: number, digits = 2) => n.toFixed(digits);

  if (!hasScores) {
    return (
      <p className={styles.empty}>No scores encoded yet — the solution appears after the first save.</p>
    );
  }

  return (
    <div className={styles.form}>
      <p className={styles.stepTitle}>Category weights — DepEd Order No. 8</p>
      <WeightsVisual
        ww={work.find((w) => w.type === "WRITTEN_WORK")?.weight ?? 0}
        pt={work.find((w) => w.type === "PERFORMANCE_TASK")?.weight ?? 0}
        qe={work.find((w) => w.type === "QUARTERLY_EXAM")?.weight ?? 0}
      />
      {work.map((w, wi) => (
        <div key={w.type} className={styles.stepBlock}>
          <p className={styles.stepTitle}>
            Step {wi + 1} · {COMPONENT_NAMES[w.type]} (weight {w.weight}%)
          </p>
          {w.parts.length === 0 ? (
            <p className={styles.workLine}>No scores yet → average 0</p>
          ) : (
            <>
              {w.parts.map((p) => (
                <p key={p.title} className={styles.workLine}>
                  {p.title}: {p.raw}/{p.max} = {fmt(p.ps, 1)}%
                </p>
              ))}
              <p className={styles.workLine}>
                Average:{" "}
                {w.parts.length > 1
                  ? `(${w.parts.map((p) => fmt(p.ps, 1)).join(" + ")}) ÷ ${w.parts.length} = `
                  : ""}
                {fmt(w.average)}%
              </p>
            </>
          )}
          <p className={styles.workLine}>
            Contributes {fmt(w.average)} × {w.weight}% = <b>{fmt(w.contribution)}</b>
          </p>
        </div>
      ))}

      <div className={styles.stepBlock}>
        <p className={styles.stepTitle}>Step {work.length + 1} · Add them up</p>
        <p className={styles.workLine}>
          {work.map((w) => fmt(w.contribution)).join(" + ")} = <b>{fmt(computed)}</b>
        </p>
      </div>

      <div className={styles.stepBlock}>
        <p className={styles.stepTitle}>Step {work.length + 2} · Transmute (DepEd table)</p>
        <p className={styles.workLine}>
          {fmt(computed)} falls in {band.low.toFixed(2)}–{band.high.toFixed(2)} →{" "}
          <b>{band.grade}</b>
        </p>
        <p className={styles.workLine}>
          {band.grade} {band.grade >= 75 ? "≥" : "<"} 75 → <b>{remarks}</b>
        </p>
      </div>

      <p className={styles.hint}>
        {student ? `Solved for ${student.name}. ` : ""}Matches the saved final grade once scores
        are (re)saved — finals recompute on every saved score.
      </p>
    </div>
  );
}
