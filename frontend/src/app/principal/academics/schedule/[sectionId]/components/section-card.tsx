"use client";

import { GraduationCap } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { scheduleTone } from "@/lib/labels/status-tone";
import type { Submission } from "./use-principal-schedule-section";
import styles from "./section-card.module.css";

/**
 * Section summary card — the top kanban card at the review desk. It uses the
 * shared kanban card shell (muted outer card, bordered header, inner white
 * card) instead of a plain tile grid; the values sit as pills inside the card.
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
  const slotCount = submission.timetableEntries.length;
  const gradeNumber = submission.gradeLevel.replace("G", "");

  return (
    <article
      aria-label={`${submission.name} section`}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <span className="text-primary" aria-hidden>
            <GraduationCap size={14} />
          </span>
          <span className="truncate">{submission.name}</span>
        </span>
        <Pill tone={scheduleTone(statusTitle.toLowerCase())}>{statusTitle}</Pill>
      </header>

      <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <span className={styles.mascot}>
          <StudentMascot name={mascotName} seed={submission.name} size={56} />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone="neutral" label="Grade level">
            Grade {gradeNumber}
          </Pill>
          <Pill
            tone={teacher ? "amber" : "neutral"}
            label="Teacher"
            className="max-w-full overflow-hidden"
          >
            <span className="truncate">{teacher ?? "No adviser assigned"}</span>
          </Pill>
          <Pill tone="neutral" label="Slots">
            {slotCount} slot{slotCount === 1 ? "" : "s"}
          </Pill>
        </div>
      </div>
    </article>
  );
}
