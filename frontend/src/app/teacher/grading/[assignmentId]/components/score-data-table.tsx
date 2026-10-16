"use client";
import * as React from "react";
import { RowList, type RowListItem } from "@/components/ui/row-list";
import { KanbanBoardEmpty } from "@/components/ui/kanban-board";
import type { ClassAssessment, ClassStudent } from "@/services/teacher/grading.types";
import { scoreOf } from "./score-input";
import { assignUniqueMascots } from "./mascot-assignment";
export function ScoreDataTable({ assessment, students, drafts, nameFilter }: { assessment: ClassAssessment; students: ClassStudent[]; drafts: Record<string, string>; nameFilter: string }) {
  const q = nameFilter.trim().toLowerCase();
  const filtered = q
    ? students.filter(
        (s) => s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q),
      )
    : students;

  // Unique mascot per student — shared with the encode view so sprites
  // never swap when toggling edit mode.
  const mascotById = React.useMemo(() => assignUniqueMascots(students), [students]);

  const items: RowListItem[] = filtered.map((s) => {
    const { num } = scoreOf(assessment, drafts, false, s.id);
    const pct =
      num !== null && assessment.maxScore > 0
        ? (num / assessment.maxScore) * 100
        : null;
    return {
      key: s.id,
      status:
        num !== null
          ? { label: "Scored", tone: "green" as const }
          : { label: "Missing", tone: "muted" as const },
      title: s.name,
      idLabel: s.lrn,
      avatarMascot: {
        name: s.name,
        seed: s.lrn,
        character: mascotById.get(s.id),
      },
      meta: [
        {
          label: num !== null ? `${num} / ${assessment.maxScore}` : `— / ${assessment.maxScore}`,
          tone: "blue" as const,
        },
        { label: pct !== null ? `${pct.toFixed(1)}%` : "—", tone: "amber" as const },
      ],
    };
  });

  if (students.length === 0) {
    return <KanbanBoardEmpty>No students in this section yet.</KanbanBoardEmpty>;
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {items.length === 0 ? (
        <KanbanBoardEmpty>No students match your search.</KanbanBoardEmpty>
      ) : (
        <RowList
          bleed
          gutter="0.625rem"
          items={items}
          ariaLabel={`Scores for ${assessment.title}`}
        />
      )}
    </div>
  );
}
