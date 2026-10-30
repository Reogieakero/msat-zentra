"use client";
import * as React from "react";
import type { CSSProperties } from "react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { KanbanBoardEmpty } from "@/components/ui/kanban-board";
import type { ClassAssessment, ClassStudent } from "@/services/teacher/grading.types";
import { ScoreCellInput, scoreOf } from "./score-input";
import { assignUniqueMascots } from "./mascot-assignment";
import { Pill } from "@/components/ui/pill";
import { formatSurnameFirst } from "@/lib/names";
import rowStyles from "@/components/ui/row-list.module.css";

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
            <Pill
              tone={scored ? "green" : "neutral"}
              label="Score status"
              className="w-fit max-w-full justify-center"
            >
              {scored ? "Scored" : "Missing"}
            </Pill>
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
              <span className={rowStyles.title} title={formatSurnameFirst(s.name)}>
                {formatSurnameFirst(s.name)}
              </span>
              <Pill tone="neutral" label="LRN" className="min-w-0 max-w-full truncate" title={s.lrn}>
                {s.lrn}
              </Pill>
            </span>
            <span className={rowStyles.metaCell}>
              <ScoreCellInput
                key={`${assessment.id}:${s.id}`}
                cacheKey={`${assessment.id}:${s.id}`}
                initial={drafts[s.id] ?? savedText}
                studentName={formatSurnameFirst(s.name)}
                assessmentTitle={assessment.title}
                onDraft={(value) => onDraftChange(s.id, value)}
              />
              <Pill tone="amber" label="Percentage" className="gap-1">
                <span
                  className={rowStyles.metaDot}
                  style={{ background: "#f59e0b" }}
                  aria-hidden
                />
                {pct !== null ? `${pct.toFixed(1)}%` : "—"}
              </Pill>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
