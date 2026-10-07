"use client";

import {
  COMPONENT_NAMES,
  bandForGrade,
  computeSubjectGrade,
  subjectEvidence,
} from "@/services/teacher/grading.compute";
import type {
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { WeightsVisual } from "./WeightsVisual";
import styles from "./SolutionContent.module.css";

type Props = {
  detail: ClassDetail;
  studentId: string;
};

export function SolutionContent({ detail, studentId }: Props) {
  const student = detail.students.find((s) => s.id === studentId);
  const result = computeSubjectGrade(subjectEvidence(detail.components, studentId));
  const hasScores = result.encodedAssessments > 0;
  const fmt = (n: number, digits = 2) => n.toFixed(digits);

  if (!hasScores) {
    return (
      <p className={styles.empty}>No scores encoded yet — the solution appears after the first save.</p>
    );
  }

  const band =
    result.computedAverage !== null ? bandForGrade(result.computedAverage) : null;
  const remarks = result.transmutedGrade == null
    ? "No grade yet"
    : result.transmutedGrade >= 75
      ? "Passed"
      : "Failed";

  return (
    <div className={styles.form}>
      <p className={styles.stepTitle}>Category weights — DepEd Order No. 8</p>
      <WeightsVisual
        ww={result.categories.find((c) => c.componentType === "WRITTEN_WORK")?.configuredWeight ?? 0}
        pt={result.categories.find((c) => c.componentType === "PERFORMANCE_TASK")?.configuredWeight ?? 0}
        exam={result.categories.find((c) => c.componentType === "EXAM")?.configuredWeight ?? 0}
      />
      {result.categories.map((c, ci) => (
        <div key={c.componentType} className={styles.stepBlock}>
          <p className={styles.stepTitle}>
            Step {ci + 1} · {COMPONENT_NAMES[c.componentType as ComponentType]} (configured {c.configuredWeight}
            %, normalized {fmt(c.normalizedWeight)}%)
          </p>
          {c.assessmentCount === 0 ? (
            <p className={styles.workLine}>No assessments — N/A, excluded from the grade.</p>
          ) : (
            <>
              {detail.components
                .find((x) => x.type === c.componentType)
                ?.assessments.filter((a) => a.scores[studentId] != null)
                .map((a) => (
                  <p key={a.id} className={styles.workLine}>
                    {a.title}: {a.scores[studentId]}/{a.maxScore} ={" "}
                    {a.maxScore > 0 ? fmt(((a.scores[studentId] ?? 0) / a.maxScore) * 100, 1) : "—"}%
                  </p>
                ))}
              <p className={styles.workLine}>
                {c.encodedCount} of {c.assessmentCount} encoded
                {c.coverage !== null ? ` (coverage ${fmt(c.coverage * 100, 1)}%)` : ""}
              </p>
              {c.percentage === null ? (
                <p className={styles.workLine}>Nothing encoded yet — N/A, excluded.</p>
              ) : (
                <p className={styles.workLine}>
                  {fmt(c.percentage)}% × effective {fmt(c.effectiveWeight)}% ={" "}
                  <b>{fmt((c.percentage * c.effectiveWeight) / 100)}</b>
                </p>
              )}
            </>
          )}
        </div>
      ))}

      <div className={styles.stepBlock}>
        <p className={styles.stepTitle}>Step {result.categories.length + 1} · Weighted raw grade</p>
        <p className={styles.workLine}>
          {result.rawGrade !== null ? <b>{fmt(result.rawGrade)}</b> : "N/A — no encoded scores"}
        </p>
      </div>

      {band && result.computedAverage !== null && result.transmutedGrade !== null ? (
        <div className={styles.stepBlock}>
          <p className={styles.stepTitle}>Step {result.categories.length + 2} · Transmute (DepEd table)</p>
          <p className={styles.workLine}>
            {fmt(result.computedAverage)} falls in {band.low.toFixed(2)}–{band.high.toFixed(2)} →{" "}
            <b>{band.grade}</b>
          </p>
          <p className={styles.workLine}>
            {band.grade} {band.grade >= 75 ? "≥" : "<"} 75 → <b>{remarks}</b>
          </p>
        </div>
      ) : null}

      <p className={styles.hint}>
        {student ? `Solved for ${student.name}. ` : ""}Matches the saved final grade once scores
        are (re)saved — finals recompute on every saved score.
      </p>
    </div>
  );
}
