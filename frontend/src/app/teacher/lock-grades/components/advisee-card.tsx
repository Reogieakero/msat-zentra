"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import type {
  LockGradesAdviseeRow,
  LockGradesSubjectRow,
} from "@/services/teacher/lockGrades.service";
import styles from "./lock-grades.module.css";

const statusLabel: Record<string, string> = {
  unlocked: "Unlocked",
  locked: "Locked",
  adviser_approved: "Adviser approved",
};

function statusTone(status: string | null | undefined): PillTone {
  if (status === "adviser_approved") return "green";
  if (status === "locked") return "amber";
  if (status === "unlocked") return "sky";
  return "neutral";
}

function subjectStatus(row: LockGradesSubjectRow): string {
  if (row.hiddenByTeacher) return "Hidden";
  if (row.lockStatus) return statusLabel[row.lockStatus] ?? row.lockStatus;
  if (row.computedAverage != null) return "Not locked";
  return "No grade";
}

function subjectTone(row: LockGradesSubjectRow): PillTone {
  if (row.hiddenByTeacher) return "neutral";
  return statusTone(row.lockStatus);
}

function subjectComputed(row: LockGradesSubjectRow): string {
  if (row.hiddenByTeacher) return "—";
  return row.computedAverage != null ? row.computedAverage.toFixed(2) : "—";
}

function subjectGrade(row: LockGradesSubjectRow): string {
  if (row.hiddenByTeacher) return "—";
  return row.transmutedGrade != null ? String(row.transmutedGrade) : "—";
}

export function LockGradesAdviseeCard({ row }: { row: LockGradesAdviseeRow }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <article className={styles.card} aria-label={row.name}>
        <div className={styles.cardHead}>
          <div className="min-w-0">
            <h3 className={styles.cardTitle}>{row.name}</h3>
            <p className={styles.cardMeta}>{row.section || "No section"}</p>
          </div>
          <Pill tone="neutral" label="LRN">
            {row.lrn || "—"}
          </Pill>
        </div>

        <div className={styles.pills}>
          <Pill tone="blue" label="Subjects">
            {row.summary.subjects} subject{row.summary.subjects === 1 ? "" : "s"}
          </Pill>
          <Pill tone="sky" label="With computed grade">
            {row.summary.graded} graded
          </Pill>
          <Pill tone="amber" label="Locked, awaiting approval">
            {row.summary.locked} locked
          </Pill>
          {!row.hasAccount ? (
            <Pill tone="neutral" label="Account">
              Roster only
            </Pill>
          ) : null}
        </div>

        <div className={styles.cardFoot}>
          <span className={`${styles.muted} text-xs`}>
            {row.summary.graded} of {row.summary.subjects} graded
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setOpen(true)}
          >
            View grades
          </Button>
        </div>
      </article>

      <KanbanOverlay
        open={open}
        onClose={() => setOpen(false)}
        title={`${row.name} — per-subject grades`}
        ariaLabel={`${row.name} per-subject grades`}
        icon={
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <BookOpen size={14} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone="neutral" label="Section">
              {row.section || "No section"}
            </Pill>
            <Pill tone="neutral" label="Subjects">
              {row.summary.subjects} subject{row.summary.subjects === 1 ? "" : "s"}
            </Pill>
            <Pill tone="amber" label="Locked, awaiting approval">
              {row.summary.locked} locked
            </Pill>
          </span>
        }
        width="lg"
      >
        {row.subjects.length === 0 ? (
          <p className={`${styles.muted} ${styles.center}`}>No subjects on this section yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {row.subjects.map((subject) => (
              <div
                key={subject.subjectId}
                className="flex flex-col gap-1.5 rounded-lg border bg-card p-2.5"
              >
                <span className="truncate text-xs font-semibold" title={subject.subject}>
                  {subject.subject}
                </span>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    Computed{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {subjectComputed(subject)}
                    </span>
                  </span>
                  <span>
                    Grade{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {subjectGrade(subject)}
                    </span>
                  </span>
                </div>
                <Pill tone={subjectTone(subject)} label="Lock status">
                  {subjectStatus(subject)}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </KanbanOverlay>
    </>
  );
}
