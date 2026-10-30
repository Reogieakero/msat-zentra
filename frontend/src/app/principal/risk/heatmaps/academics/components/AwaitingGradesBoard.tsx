"use client";

import { Clock, X } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { UngradedStudent } from "./types";
import styles from "./academics.module.css";

/**
 * Adviser-shared learners who have a roster slot but no grade record yet.
 * Opened by tapping the "Awaiting grades" stat board; each learner is its own
 * mini kanban board, matching the section roster on /principal/academics.
 */
export function AwaitingGradesBoard({
  students,
  onClose,
}: {
  students: UngradedStudent[];
  onClose: () => void;
}) {
  return (
    <KanbanBoard
      className={styles.tableBoard}
      title="Awaiting grades"
      icon={
        <span className={styles.icon} aria-hidden="true">
          <Clock size={14} />
        </span>
      }
      count={students.length}
      description="Adviser-shared learners on the roll with no grade record yet this term."
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Hide awaiting grades list"
          style={{ height: "1.75rem" }}
        >
          <X size={14} aria-hidden />
          Hide
        </Button>
      }
      ariaLabel="Students awaiting grades"
    >
      <div
        className={styles.ungradedGrid}
        aria-label="Shared students without grade records"
      >
        {students.map((student, index) => (
          <article
            key={student.studentId}
            className={styles.ungradedBoard}
            style={{ animationDelay: `${60 + Math.min(index, 11) * 40}ms` }}
          >
            <header className={styles.ungradedHead}>
              <StudentMascot
                name={student.name}
                seed={student.lrn}
                character={student.mascot ?? undefined}
                size={32}
              />
              <span className={styles.ungradedMeta}>
                <span className={styles.ungradedName}>{student.name}</span>
                <Pill
                  tone="neutral"
                  label="LRN"
                  className={`${styles.ungradedLrn} tabular-nums`}
                >
                  {student.lrn}
                </Pill>
              </span>
            </header>
            <div className={styles.ungradedPills}>
              <Pill tone="amber" label="Section">
                {student.section}
              </Pill>
              <Pill tone="neutral" label="Grade level">
                {student.grade}
              </Pill>
            </div>
            <Pill tone="amber" label="Grade record" className={styles.ungradedNote}>
              No grade record yet
            </Pill>
          </article>
        ))}
      </div>
    </KanbanBoard>
  );
}
