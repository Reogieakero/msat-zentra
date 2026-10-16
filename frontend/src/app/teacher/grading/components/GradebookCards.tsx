"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { AmberRectPill } from "../../classes/components/UnlinkCodeDialog";
import type {
  ClassAverageRow,
  SubjectAssessmentRow,
  TeacherClassRow,
} from "@/services/teacher/overview.types";
import styles from "./GradebookCards.module.css";

type Props = {
  classes: TeacherClassRow[];
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
};

export function GradebookCards({ classes, assessments, standings }: Props) {
  if (classes.length === 0) {
    return (
      <p className={styles.empty}>
        No classes assigned yet — ask your registrar to assign your subjects and sections first.
      </p>
    );
  }

  return (
    <div className={`grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3 ${styles.gridEnter}`} role="group" aria-label="Gradebook subjects">
      {classes.map((c, i) => {
        // Class ids are `${subjectId}|${sectionId}` in gradebook scope —
        // match added assessments by IDs when present so shared-subject
        // sections never collapse to 0. Fall back to names for legacy rows.
        const [classSubjectId, classSectionId] = c.id.includes("|")
          ? c.id.split("|")
          : [];
        const classAssessments = assessments.filter((a) => {
          if (a.subjectId && a.sectionId && classSubjectId && classSectionId) {
            return a.subjectId === classSubjectId && a.sectionId === classSectionId;
          }
          return a.subject === c.subject && a.section === c.section;
        });
        const assessmentCount = classAssessments.length;
        // Progress = students graded per added assessment:
        // scored entries across added assessments over
        // (added assessments × students). Falls back to final-standings
        // only for legacy rows without scored counts.
        const hasScoredData = classAssessments.some((a) => typeof a.scored === "number");
        const totalScored = classAssessments.reduce(
          (n, a) => n + (typeof a.scored === "number" ? a.scored : 0),
          0,
        );
        const totalPossible = assessmentCount * c.studentCount;
        const standing =
          standings.find((s) => s.subject === c.subject && s.section === c.section) ?? null;
        const pct = hasScoredData
          ? totalPossible > 0
            ? Math.round((totalScored / totalPossible) * 100)
            : 0
          : standing && standing.students > 0
            ? Math.round((standing.assessed / standing.students) * 100)
            : 0;
        const progressLabel = hasScoredData
          ? `${totalScored} of ${totalPossible} graded`
          : `${standing?.assessed ?? 0} of ${standing?.students ?? c.studentCount} assessed`;
        return (
          <div
            key={c.id}
            className={styles.boardIn}
            style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
          >
          <KanbanBoard
            ariaLabel={`${c.subject}, ${c.section}, ${c.gradeLevel}`}
            title={
              <span className="truncate" title={c.subject}>
                {c.subject}
              </span>
            }
            icon={
              <span className="text-amber-500" aria-hidden>
                <BookOpen size={14} />
              </span>
            }
            count={
              <span className="text-amber-600 dark:text-amber-500">{assessmentCount}</span>
            }
            actions={
              <span className="flex items-center gap-1.5">
                <AmberRectPill>{c.section}</AmberRectPill>
                <AmberRectPill>{c.gradeLevel}</AmberRectPill>
              </span>
            }
            description={`${c.studentCount} student${c.studentCount === 1 ? "" : "s"} enrolled`}
            className="h-full"
            footer={
              <div className="flex justify-end px-1 pb-1">
                <Button
                  asChild
                  size="sm"
                  className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  <Link href={`/teacher/grading/${c.id}`}>Open gradebook</Link>
                </Button>
              </div>
            }
          >
            <div className="flex gap-4 px-1">
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {c.studentCount}
                </span>
                <span className="text-[11px] text-muted-foreground">Students</span>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {assessmentCount}
                </span>
                <span className="text-[11px] text-muted-foreground">Added assessments</span>
              </span>
            </div>
            <div className="flex flex-col gap-1 px-1">
              <span
                className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={progressLabel}
              >
                <span className={`block h-full rounded-full bg-primary ${styles.progressFill}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="text-xs text-muted-foreground">
                {progressLabel}
              </span>
            </div>
          </KanbanBoard>
          </div>
        );
      })}
    </div>
  );
}
