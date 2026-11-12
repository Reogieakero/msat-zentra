"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClassDetail } from "@/services/teacher/grading.service";
import type { LockGradesClassRow } from "@/services/teacher/lockGrades.service";
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

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function LearnerRows({ assignmentId }: { assignmentId: string }) {
  const detail = useClassDetail(assignmentId);

  if (detail.isPending) {
    return (
      <div className={styles.learners} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.learnerRow}>
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="ml-auto h-3.5 w-8" />
            <Skeleton className="ml-auto h-3.5 w-8" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return <p className={styles.error}>Could not load this class&apos;s learners.</p>;
  }

  if (detail.data.students.length === 0) {
    return <p className={`${styles.muted} ${styles.center}`}>No learners in this section yet.</p>;
  }

  return (
    <div className={styles.learners} role="table" aria-label="Class learners">
      <div className={styles.learnersHead} role="row">
        <span role="columnheader">Learner</span>
        <span className={styles.num} role="columnheader">Computed</span>
        <span className={styles.num} role="columnheader">Grade</span>
        <span role="columnheader">Status</span>
      </div>
      {detail.data.students.map((student) => {
        const final = student.final;
        const status = final?.lockStatus ?? null;
        return (
          <div key={student.id} className={styles.learnerRow} role="row">
            <span className={styles.learnerName} title={student.name} role="cell">
              {student.name}
            </span>
            <span className={`${styles.num} ${styles.muted}`} role="cell">
              {final?.computedAverage != null ? final.computedAverage.toFixed(2) : "—"}
            </span>
            <span className={styles.num} role="cell">
              {final?.transmutedGrade != null ? final.transmutedGrade : "—"}
            </span>
            <span className={styles.pills} role="cell">
              <Pill tone={statusTone(status)} label="Lock status">
                {status ? statusLabel[status] ?? status : "No grade"}
              </Pill>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LockGradesClassCard({
  row,
}: {
  row: LockGradesClassRow;
}) {
  const [open, setOpen] = React.useState(false);
  const total = row.learners;
  const nothingReady = row.ready === 0 && row.locked === 0 && row.approved === 0;

  return (
    <article className={styles.card} aria-label={`${row.subject}, ${row.section}`}>
      <div className={styles.cardHead}>
        <div className="min-w-0">
          <h3 className={styles.cardTitle}>{row.subject}</h3>
          <p className={styles.cardMeta}>
            {row.section} · {row.gradeLevel} · {row.learners} learner{row.learners === 1 ? "" : "s"}
          </p>
        </div>
        <Pill tone="neutral" label="Subject code">
          {row.subjectCode}
        </Pill>
      </div>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={styles.segments}
              tabIndex={0}
              role="img"
              aria-label={`${row.ready} ready, ${row.locked} locked, ${row.approved} approved`}
            >
              <span className={styles.segReady} style={{ width: `${pct(row.ready, total)}%` }} />
              <span className={styles.segLocked} style={{ width: `${pct(row.locked, total)}%` }} />
              <span className={styles.segApproved} style={{ width: `${pct(row.approved, total)}%` }} />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="border-0 bg-transparent p-0 text-inherit shadow-none [&>svg]:hidden"
          >
            <ChartTooltip
              active
              label="Grade lock progress"
              payload={[
                { name: "Ready", value: row.ready, payload: { fill: "#0ea5e9" } },
                { name: "Locked", value: row.locked, payload: { fill: "#f59e0b" } },
                { name: "Approved", value: row.approved, payload: { fill: "#22c55e" } },
              ]}
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className={styles.segmentRow}>
        <span>{row.computed} with grade</span>
        <span className={styles.pills}>
          <Pill tone="sky" label="Ready to lock">
            {row.ready} ready
          </Pill>
          <Pill tone="amber" label="Locked, awaiting approval">
            {row.locked} locked
          </Pill>
        </span>
      </div>

      <div className={styles.cardFoot}>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setOpen(true)}>
          View learners
        </Button>
      </div>

      {nothingReady ? (
        <div className="flex justify-center pt-1">
          <Pill
            tone="neutral"
            label="No computed final grades are ready to lock in this class yet."
          >
            Nothing ready to lock yet
          </Pill>
        </div>
      ) : null}

      <KanbanOverlay
        open={open}
        onClose={() => setOpen(false)}
        title={`${row.subject} — ${row.section}`}
        ariaLabel={`${row.subject} learners`}
        icon={
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <Users size={14} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone="neutral" label="Grade level">
              {row.gradeLevel}
            </Pill>
            <Pill tone="neutral" label="Learners">
              {row.learners} learner{row.learners === 1 ? "" : "s"}
            </Pill>
            <Pill tone="sky" label="Ready to lock">
              {row.ready} ready to lock
            </Pill>
          </span>
        }
        width="xl"
      >
        {open ? <LearnerRows assignmentId={row.id} /> : null}
      </KanbanOverlay>
    </article>
  );
}
