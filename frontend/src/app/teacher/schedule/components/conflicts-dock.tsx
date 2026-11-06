"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEEK_LABELS_FULL } from "@/services/teacher/schedule";
import type { TemplateConflict } from "./use-schedule-conflicts";

const MAX_ROWS = 8;

function Amber({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-amber-600 dark:text-amber-400">{children}</span>;
}

function joinNodes(nodes: React.ReactNode[]): React.ReactNode {
  return nodes.map((n, i) => (
    <Fragment key={i}>
      {i > 0 ? (i === nodes.length - 1 ? (nodes.length > 2 ? ", and " : " and ") : ", ") : null}
      {n}
    </Fragment>
  ));
}

function describeConflict(c: TemplateConflict): React.ReactNode {
  const weekday = WEEK_LABELS_FULL[c.day - 1] ?? `Day ${c.day}`;
  const slot = `${weekday}, period ${c.period + 1}`;
  if (c.sections.length === 0) {
    return (
      <>
        <Amber>{c.teacherName}</Amber> has a conflict on <Amber>{slot}</Amber>.
      </>
    );
  }
  const subjects = [...new Set(c.sections.map((s) => s.subjectName))];
  if (subjects.length === 1) {
    return (
      <>
        <Amber>{c.teacherName}</Amber> teaches <Amber>{subjects[0]}</Amber> in both{" "}
        {joinNodes(c.sections.map((s) => <Amber key={s.sectionId}>{s.sectionName}</Amber>))} on <Amber>{slot}</Amber>.
      </>
    );
  }
  return (
    <>
      <Amber>{c.teacherName}</Amber> is double-booked on <Amber>{slot}</Amber> with{" "}
      {joinNodes(c.sections.map((s) => (
        <Amber key={s.sectionId}>
          {s.subjectName} in {s.sectionName}
        </Amber>
      )))}
      .
    </>
  );
}

interface Props {
  conflicts: TemplateConflict[];
}

export function ConflictsDock({ conflicts }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (conflicts.length === 0 || hidden) return null;

  const shown = conflicts.slice(0, MAX_ROWS);
  const rest = conflicts.length - shown.length;
  const title = "Teacher time conflicts (warn-allow — already saved)";

  return (
    <div
      className="fixed bottom-4 left-4 z-40 w-80 overflow-hidden rounded-xl border border-amber-500/40 bg-card text-card-foreground shadow-2xl sm:w-96"
      role="alert"
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex items-center gap-2 border-b border-amber-500/20 px-3 py-2">
        <AlertTriangle size={14} aria-hidden className="shrink-0 text-amber-500" />
        <span
          className="min-w-0 flex-1 truncate font-sans text-xs font-semibold"
          title={`${title} · ${conflicts.length}`}
        >
          {title} · {conflicts.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Expand time conflicts" : "Minimize time conflicts"}
        >
          {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2"
          onClick={() => setHidden(true)}
          aria-label="Dismiss time conflicts"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
      {!minimized ? (
        <div className="max-h-48 overflow-y-auto p-3">
          <ul className="list-disc space-y-1 pl-5 font-sans text-xs text-muted-foreground">
            {shown.map((c) => (
              <li key={`${c.teacherNameId}:${c.day}:${c.period}`}>{describeConflict(c)}</li>
            ))}
          </ul>
          {rest > 0 ? (
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              …and {rest} more
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
