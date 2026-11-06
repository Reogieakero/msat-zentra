"use client";
import { typedCache } from "./score-storage";
import styles from "./ScoreGrid.module.css";
import type { ClassAssessment } from "@/services/teacher/grading.types";
export function sanitizeScore(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
}
export function scoreOf(assessment: ClassAssessment, drafts: Record<string, string>, editing: boolean, studentId: string): { text: string; num: number | null } {
  const text = editing ? (drafts[studentId] ?? "") : assessment.scores[studentId] != null ? String(assessment.scores[studentId]) : "";
  const num = Number(text);
  return { text, num: text.trim() !== "" && Number.isFinite(num) ? num : null };
}
export function ScoreCellInput({ cacheKey, initial, studentName, assessmentTitle, onDraft }: { cacheKey: string; initial: string; studentName: string; assessmentTitle: string; onDraft: (value: string) => void }) {
  return (
    <input
      className={styles.scoreInput}
      inputMode="decimal"
      defaultValue={typedCache.get(cacheKey) ?? initial}
      aria-label={`${assessmentTitle} score for ${studentName}`}
      onChange={(e) => {
        e.target.value = sanitizeScore(e.target.value);
        typedCache.set(cacheKey, e.target.value);
        onDraft(e.target.value);
      }}
    />
  );
}
