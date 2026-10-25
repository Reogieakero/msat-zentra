"use client";

import { GraduationCap } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { scheduleTone } from "@/lib/labels/status-tone";
import type { Submission } from "./use-principal-schedule-section";
import styles from "./section-card.module.css";

/**
 * Section summary card — the kanban card at the top of the review desk with
 * the section name, grade level, adviser and its mascot.
 */
export function SectionCard({
  submission,
  statusTitle,
}: {
  submission: Submission;
  statusTitle: string;
}) {
  const teacher = submission.adviser?.fullName ?? null;
  const mascotName = teacher ?? submission.name;

  return (
    <KanbanBoard
      title={submission.name}
      icon={
        <span className="text-primary" aria-hidden>
          <GraduationCap size={14} />
        </span>
      }
      count={submission.timetableEntries.length}
      ariaLabel={`${submission.name} section`}
      actions={<Pill tone={scheduleTone(statusTitle.toLowerCase())}>{statusTitle}</Pill>}
    >
      <div className={styles.row}>
        <span className={styles.mascot}>
          <StudentMascot name={mascotName} seed={submission.name} size={56} />
        </span>
        <div className={styles.body}>
          <p className={styles.section}>
            <span className={styles.label}>Section</span>
            <span className={styles.value} title={submission.name}>
              {submission.name}
            </span>
          </p>
          <p className={styles.line}>
            <span className={styles.label}>Grade level</span>
            <Pill tone="neutral">Grade {submission.gradeLevel.replace("G", "")}</Pill>
          </p>
          <p className={styles.line}>
            <span className={styles.label}>Teacher</span>
            <span className={styles.value} title={teacher ?? undefined}>
              {teacher ?? <span className={styles.none}>No adviser assigned</span>}
            </span>
          </p>
        </div>
      </div>
    </KanbanBoard>
  );
}
