"use client";

import * as React from "react";
import Link from "next/link";
import { Info, ListChecks, Plus, Send, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { AdvisoryModuleKind } from "@/services/teacher/advisoryModules.service";

/** Same legend tones as the module cards on the filled board. */
const STATUS_ENTRIES: { key: string; label: string; hint: string; tone: PillTone }[] = [
  { key: "posted", label: "Posted", hint: "General post — no submissions tracked", tone: "blue" },
  { key: "pending", label: "Pending", hint: "Released, not yet handed in", tone: "amber" },
  { key: "submitted", label: "Submitted", hint: "Every ADM learner handed it in", tone: "green" },
  { key: "overdue", label: "Overdue", hint: "Past the due date, still missing", tone: "red" },
];

function ColumnHead({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={count !== undefined && !action ? `${title}, ${count}` : title}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {action ??
          (count !== undefined ? (
            <span className="text-xs font-semibold text-muted-foreground">{count}</span>
          ) : null)}
      </span>
    </div>
  );
}

function ActionCard({
  actionLabel,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  actionLabel: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Open ${title}`}
      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground" title={actionLabel}>
          {actionLabel}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon size={13} />
        </span>
      </span>
      <span className="truncate text-sm font-semibold leading-snug" title={title}>
        {title}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
    </button>
  );
}

function LinkCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}) {
  return (
    <Link
      href={href}
      aria-label={`Open ${title}`}
      className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground" title={href}>
          {href}
        </span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon size={13} />
        </span>
      </span>
      <span className="truncate text-sm font-semibold leading-snug" title={title}>
        {title}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
    </Link>
  );
}

export function ModulesEmptyKanban({
  onAdd,
  sectionPicker,
}: {
  /** Opens the release dialog, preselected to the requested module type. */
  onAdd: (kind: AdvisoryModuleKind) => void;
  /** Advisory section switch, shown when the adviser has more than one. */
  sectionPicker?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="modules-empty-board" className="flex min-w-0 flex-col gap-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="modules-empty-board"
              className="m-0 text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground"
            >
              No modules released yet
            </h2>
            <p className="m-0 text-[0.8125rem] leading-[1.45] text-muted-foreground">
              Modules you release this term will appear here. Pick a starting point below.
            </p>
          </div>
          {sectionPicker ? <div className="shrink-0">{sectionPicker}</div> : null}
        </div>

        <div
          className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-2"
          role="group"
          aria-label="Module starter actions"
        >
          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5 [font-family:var(--font-inter)]"
            aria-label="New Module"
          >
            <ColumnHead
              icon={<Send size={14} aria-hidden className="text-blue-500" />}
              title="New Module"
              action={
                <Button
                  type="button"
                  className="h-6 w-6 px-0"
                  aria-label="Release a general module"
                  onClick={() => onAdd("general")}
                >
                  <Plus aria-hidden />
                </Button>
              }
            />
            <ActionCard
              actionLabel="action/new-module"
              title="Release a module"
              description="Post a link and due date for your whole advisory section"
              icon={Send}
              onSelect={() => onAdd("general")}
            />
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5 [font-family:var(--font-inter)]"
            aria-label="ADM Module"
          >
            <ColumnHead
              icon={<ListChecks size={14} aria-hidden className="text-violet-500" />}
              title="ADM Module"
              action={
                <Button
                  type="button"
                  className="h-6 w-6 px-0"
                  aria-label="Release an ADM module"
                  onClick={() => onAdd("adm")}
                >
                  <Plus aria-hidden />
                </Button>
              }
            />
            <ActionCard
              actionLabel="action/new-adm-module"
              title="Track submissions"
              description="Release an ADM module and track every learner's answer"
              icon={ListChecks}
              onSelect={() => onAdd("adm")}
            />
          </div>

          <div
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5 [font-family:var(--font-inter)]"
            aria-label="Advisory List"
          >
            <ColumnHead
              icon={<UserRoundSearch size={14} aria-hidden className="text-amber-500" />}
              title="Advisory List"
              action={
                <Button asChild variant="outline" className="h-6 px-2 text-[11px]">
                  <Link href="/teacher/advisory/list">See all</Link>
                </Button>
              }
            />
            <LinkCard
              href="/teacher/advisory/list"
              title="Advisory List"
              description="Check the learners in your section before releasing"
              icon={UserRoundSearch}
            />
          </div>

          <div
            className="flex h-full min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5 [font-family:var(--font-inter)]"
            aria-label={`Status Legend, ${STATUS_ENTRIES.length}`}
          >
            <ColumnHead
              icon={<Info size={14} aria-hidden className="text-amber-500" />}
              title="Status Legend"
              count={STATUS_ENTRIES.length}
            />
            <ul
              className="flex min-w-0 flex-1 flex-row flex-wrap content-center items-center justify-center gap-1.5"
              aria-label="Module status legend"
            >
              {STATUS_ENTRIES.map((entry) => (
                <li key={entry.key} className="flex">
                  <Pill tone={entry.tone} label={entry.hint}>
                    {entry.label}
                  </Pill>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
