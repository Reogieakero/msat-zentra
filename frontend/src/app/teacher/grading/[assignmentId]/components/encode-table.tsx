"use client";
import * as React from "react";
import type { CSSProperties } from "react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { KanbanBoardEmpty } from "@/components/ui/kanban-board";
import type { ClassAssessment, ClassStudent } from "@/services/teacher/grading.types";
import { ScoreCellInput, scoreOf } from "./score-input";
import { assignUniqueMascots } from "./mascot-assignment";
import rowStyles from "@/components/ui/row-list.module.css";

/* Same pill language as RowList rows: status left, live % right. */
const PILL_BASE =
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium";
const STATUS_GREEN =
  "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400";
const STATUS_MUTED = "border-border bg-muted text-muted-foreground";
const PCT_AMBER =
  "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
const LRN_PILL =
  "inline-flex shrink-0 items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground";

export function PlainEncodeTable({ assessment, students, drafts, nameFilter, onDraftChange }: { assessment: ClassAssessment; students: ClassStudent[]; drafts: Record<string, string>; nameFilter: string; onDraftChange: (studentId: string, value: string) => void }) {
  const q = nameFilter.trim().toLowerCase();
  const rows = q ? students.filter((s) => s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q)) : students;
  const mascotById = React.useMemo(() => assignUniqueMascots(students), [students]);
  if (students.length === 0) {
    return <KanbanBoardEmpty>No students in this section yet.</KanbanBoardEmpty>;
  }
  if (rows.length === 0) {
    return <KanbanBoardEmpty>No students match your search.</KanbanBoardEmpty>;
  }
  return (
    <ul
      className={`${rowStyles.list} ${rowStyles.listBleed}`}
      style={{ "--row-list-gutter": "0.625rem" } as CSSProperties}
      aria-label={`Encode scores for ${assessment.title}`}
    >
      {rows.map((s) => {
        const savedText = assessment.scores[s.id] != null ? String(assessment.scores[s.id]) : "";
        const { num } = scoreOf(assessment, drafts, true, s.id);
        const shownNum = num ?? (savedText !== "" ? Number(savedText) : null);
        const scored = shownNum !== null;
        const pct =
          shownNum !== null && assessment.maxScore > 0
            ? (shownNum / assessment.maxScore) * 100
            : null;
        return (
          <li
            key={s.id}
            className={rowStyles.row}
            aria-label={`${scored ? "Scored" : "Missing"}: ${s.name}`}
          >
            <span
              className={`${PILL_BASE} w-fit max-w-full justify-center ${scored ? STATUS_GREEN : STATUS_MUTED}`}
            >
              {scored ? "Scored" : "Missing"}
            </span>
            <span className={rowStyles.sep} aria-hidden>
              |
            </span>
            <span className={rowStyles.titleCell}>
              <StudentMascot
                name={s.name}
                seed={s.lrn}
                character={mascotById.get(s.id)}
                size={28}
              />
              <span className={rowStyles.title} title={s.name}>
                {s.name}
              </span>
              <span className={LRN_PILL} title={s.lrn}>
                {s.lrn}
              </span>
            </span>
            <span className={rowStyles.metaCell}>
              <ScoreCellInput
                key={`${assessment.id}:${s.id}`}
                cacheKey={`${assessment.id}:${s.id}`}
                initial={drafts[s.id] ?? savedText}
                studentName={s.name}
                assessmentTitle={assessment.title}
                onDraft={(value) => onDraftChange(s.id, value)}
              />
              <span className={`${PILL_BASE} gap-1 ${PCT_AMBER}`}>
                <span
                  className={rowStyles.metaDot}
                  style={{ background: "#f59e0b" }}
                  aria-hidden
                />
                {pct !== null ? `${pct.toFixed(1)}%` : "—"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
