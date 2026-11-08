"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCheck, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { useDock } from "@/components/dock/dock-store";
import {
  useConfirmTermContext,
  useTermContext,
} from "@/services/teacher/termContext.service";

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })
    ?.response?.data;
  const serverMessage = data?.error?.message ?? data?.message;
  if (typeof serverMessage === "string" && serverMessage) return serverMessage;
  return err instanceof Error ? err.message : "Could not confirm the term.";
}

/**
 * Adviser-only, once-per-term check. Inside one school year the roster is
 * shared by all three terms, so nothing is copied or deleted here: the adviser
 * only says whether the students/classes they handle are the same as last
 * term. "Same" keeps the previous term as the default view; "not the same"
 * starts the term with an empty class list (students stay on the year roster).
 */
export function RosterCarryOverOverlay() {
  const { data, refetch } = useTermContext();
  const confirm = useConfirmTermContext();
  const { startTask, completeTask, failTask } = useDock();
  const [dismissedKey, setDismissedKey] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<{ key: string; value: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!data || !data.isAdviser || !data.needsConfirmation || !data.term) return null;

  const term = data.term;
  const previous = data.previousTerm;
  const openKey = `${term.id}:${data.roster.fingerprint}`;
  if (dismissedKey === openKey) return null;

  // Default answer: whatever the adviser picked before, else "same".
  const sameAsPrevious =
    picked && picked.key === openKey ? picked.value : (data.sameAsPrevious ?? true);
  const previousLabel = previous
    ? `Term ${previous.termNumber}`
    : "the previous term";
  const keptClasses =
    data.classes.current.length > 0
      ? data.classes.current
      : data.classes.previous;

  const handleClose = () => {
    setError(null);
    setDismissedKey(openKey);
  };

  const handleConfirm = () => {
    if (confirm.isPending) return;
    const taskDescription = sameAsPrevious
      ? `Same students and classes as ${previousLabel}`
      : "Starting fresh with an empty class list";
    // Close at once: the confirmation keeps running in the shared dock, so the
    // adviser is never held on the modal while the request settles.
    setError(null);
    setDismissedKey(openKey);
    const taskId = startTask({
      kind: "term-context",
      title: `Confirming Term ${term.termNumber}`,
      description: taskDescription,
    });
    void (async () => {
      try {
        await confirm.mutateAsync({
          kind: "roster",
          fingerprint: data.roster.fingerprint,
          sameAsPrevious,
        });
        completeTask(
          taskId,
          sameAsPrevious
            ? `Term ${term.termNumber} confirmed — same students and classes as ${previousLabel}`
            : `Term ${term.termNumber} confirmed — starting with an empty class list`,
        );
      } catch (err) {
        const message = errorMessage(err);
        failTask(taskId, message);
        // Keep the modal useful after a failure: reopen it with the problem and
        // re-read the roster (409 ROSTER_CHANGED means it moved under us).
        setError(message);
        setDismissedKey(null);
        void refetch();
      }
    })();
  };

  return (
    <KanbanOverlay
      open
      onClose={handleClose}
      width="md"
      icon={
        <span className="text-primary" aria-hidden>
          <Users size={14} />
        </span>
      }
      title={`Term ${term.termNumber} — same students and classes?`}
      description={
        <>
          {term.schoolYearName} · Term {term.termNumber}
          {formatRange(term.startDate, term.endDate)
            ? ` · ${formatRange(term.startDate, term.endDate)}`
            : ""}
        </>
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-3 text-xs"
            onClick={handleClose}
            disabled={confirm.isPending}
          >
            Later
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={handleConfirm}
            autoFocus
          >
            <CheckCheck size={13} aria-hidden />
            Continue to Term {term.termNumber}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-1 pb-1 text-sm">
        <p className="text-muted-foreground">
          Records for Term {term.termNumber} are <strong className="text-foreground">new for this term</strong>{" "}
          — grades, attendance, anecdotal records and reports start empty.
          {data.changedSinceAck ? " The roster also changed since you last confirmed." : ""}
        </p>

        <div
          role="radiogroup"
          aria-label="Same students and classes as last term?"
          className="grid gap-2"
        >
          <ChoiceCard
            selected={sameAsPrevious}
            onSelect={() => setPicked({ key: openKey, value: true })}
            title={`Same students and classes as ${previousLabel}`}
            hint={
              keptClasses.length > 0
                ? `Keep ${data.roster.total} students and ${keptClasses.length} classes as the default view for Term ${term.termNumber}.`
                : `Keep the ${data.roster.total} students from ${previousLabel} as the default view.`
            }
            chips={
              <>
                <Chip icon={<Users size={12} aria-hidden />}>
                  {data.roster.total} students
                </Chip>
                {keptClasses.length > 0 ? (
                  <Chip>{keptClasses.length} classes</Chip>
                ) : null}
              </>
            }
          />
          <ChoiceCard
            selected={!sameAsPrevious}
            onSelect={() => setPicked({ key: openKey, value: false })}
            title="Not the same / start fresh"
            hint={`Students stay on the year roster. Term ${term.termNumber} starts with an empty class list — add what you need.`}
            chips={<Chip>0 classes</Chip>}
          />
        </div>

        {data.newLearners.length > 0 ? (
          <p className="flex items-start gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
            <UserPlus size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Newly enlisted this term:{" "}
              {data.newLearners.map((l) => l.name).join(", ")}
            </span>
          </p>
        ) : null}

        {data.advisorySections.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Advisory section{data.advisorySections.length === 1 ? "" : "s"}:{" "}
            {data.advisorySections.map((s) => s.name).join(", ")}.{" "}
            <Link
              href="/teacher/advisory/list"
              className="font-semibold text-primary hover:underline"
            >
              Manage roster
            </Link>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </KanbanOverlay>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  hint,
  chips,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  chips: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span
          aria-hidden
          className={`text-[11px] font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}
        >
          {selected ? "● Selected" : "○ Select"}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="flex flex-wrap gap-1 pt-0.5">{chips}</span>
    </button>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
      {icon}
      {children}
    </span>
  );
}
