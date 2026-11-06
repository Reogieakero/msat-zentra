"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Pagination } from "@/components/shared/pagination";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { toSlug } from "@/lib/slug";
import type {
  AdvisoryModuleStatus,
  AdvisorySubmissionKind,
  AdvisorySubmissionRow,
  ModuleStatusCounts,
} from "@/services/teacher/advisoryModules.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const STATUS: Record<
  AdvisoryModuleStatus,
  { label: string; tone: PillTone; icon: typeof CheckCircle2 }
> = {
  submitted: { label: "Submitted", tone: "green", icon: CheckCircle2 },
  pending: { label: "Not yet submitted", tone: "red", icon: Clock3 },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  posted: { label: "Posted", tone: "blue", icon: CheckCircle2 },
};

const KIND: Record<AdvisorySubmissionKind, { label: string; tone: PillTone }> = {
  link: { label: "Link", tone: "blue" },
  file: { label: "File", tone: "violet" },
  physical: { label: "In person", tone: "teal" },
};

/** The learner's answer, as a link / file / plain note. */
function AnswerLink({ row }: { row: AdvisorySubmissionRow }) {
  if (row.submissionKind === "link" && row.submissionUrl) {
    return (
      <a
        href={row.submissionUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        title={row.submissionUrl}
      >
        <ExternalLink size={12} className="shrink-0" aria-hidden />
        <span className="truncate">Open submitted link</span>
      </a>
    );
  }
  if (row.submissionKind === "file" && row.fileUrl) {
    return (
      <a
        href={row.fileUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        title={row.fileUrl}
      >
        <ExternalLink size={12} className="shrink-0" aria-hidden />
        <span className="truncate">{row.fileName ?? "Open file"}</span>
      </a>
    );
  }
  if (row.submitted && row.submissionKind === "physical") {
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        Passed in person
        {row.fileUrl ? (
          <a
            href={row.fileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-primary hover:underline"
          >
            · View proof
          </a>
        ) : null}
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">No answer yet</span>;
}

function SubmissionCard({ row }: { row: AdvisorySubmissionRow }) {
  const status = STATUS[row.status];
  const StatusIcon = status.icon;
  const submittedOn = row.submittedAt ? dateLabel(row.submittedAt) : "Not yet";

  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20"
      aria-label={`${row.name}, ${status.label}`}
    >
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="flex min-w-0 items-center gap-2">
          <StudentMascot
            name={row.name}
            seed={row.lrn}
            character={row.mascot ?? undefined}
            size={26}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold text-foreground" title={row.name}>
              {row.name}
            </span>
            <span className="truncate text-[10px] text-muted-foreground tabular-nums">
              LRN {row.lrn}
            </span>
          </span>
        </span>
        <Pill tone={status.tone} label="Submission status">
          <StatusIcon size={11} aria-hidden /> {status.label}
        </Pill>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {row.submitted ? (
            <Pill tone={KIND[row.submissionKind].tone} label="Submission type">
              {KIND[row.submissionKind].label}
            </Pill>
          ) : (
            <Pill tone="neutral" label="Submission type">
              No submission
            </Pill>
          )}
          <Pill tone="neutral" label="Submitted on" title={submittedOn}>
            {submittedOn}
          </Pill>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Answer
          </span>
          <AnswerLink row={row} />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Remarks
          </span>
          <span className="line-clamp-2 text-[11px] text-foreground" title={row.remarks ?? undefined}>
            {row.remarks || "—"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end px-0.5">
        <Button asChild className="h-6 px-2 text-[11px]">
          <a
            href={`/teacher/advisory/adm-cases/${toSlug(row.name)}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Monitor ${row.name} in a new tab`}
          >
            <ClipboardList size={11} aria-hidden /> Monitor student
          </a>
        </Button>
      </div>
    </article>
  );
}

export function SubmissionsTable({
  moduleName,
  rows,
  counts,
  total,
  page,
  onPageChange,
}: {
  moduleName: string;
  rows: AdvisorySubmissionRow[];
  counts: ModuleStatusCounts;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      aria-label="Student submissions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-sm font-bold tracking-[-0.01em] text-foreground">
            Student submissions
          </h2>
          <Pill tone="blue" label="Module" title={moduleName}>
            {moduleName}
          </Pill>
        </div>
        <Pill tone="blue" label="Submitted submissions">
          {counts.submitted}/{counts.all} submitted
        </Pill>
      </div>

      {counts.all === 0 ? (
        <p className="m-0 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
          No advisees in this section yet.
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
          No submissions yet.
        </p>
      ) : (
        <div
          className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]"
          role="list"
          aria-label="Learner submissions"
        >
          {rows.map((row) => (
            <div key={row.key} role="listitem" className="min-w-0">
              <SubmissionCard row={row} />
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} onPageChange={onPageChange} />
    </section>
  );
}
