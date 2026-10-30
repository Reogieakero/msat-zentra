"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import type {
  AdvisoryModuleRow,
  AdvisoryModuleStatus,
  ModuleStatusCounts,
} from "@/services/teacher/advisoryModules.service";
import { Pagination } from "@/components/shared/pagination";

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
  pending: { label: "Pending", tone: "amber", icon: Clock3 },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  posted: { label: "Posted", tone: "blue", icon: Megaphone },
};

const FILTER_LABELS: Record<keyof ModuleStatusCounts, string> = {
  all: "All",
  submitted: "Submitted",
  pending: "Pending",
  overdue: "Overdue",
};

export function ModulesPanel({
  rows,
  counts,
  total,
  page,
  selectedId,
  filter,
  headerActions,
  onFilterChange,
  onPageChange,
  onAdd,
  onEdit,
  onDelete,
  onSelect,
  onOpen,
}: {
  rows: AdvisoryModuleRow[];
  counts: ModuleStatusCounts;
  total: number;
  page: number;
  selectedId: string | null;
  filter: keyof ModuleStatusCounts;
  /** Extra controls (e.g. the advisory section picker) shown beside Add module. */
  headerActions?: React.ReactNode;
  onFilterChange: (filter: keyof ModuleStatusCounts) => void;
  onPageChange: (page: number) => void;
  onAdd: () => void;
  onEdit: (module: AdvisoryModuleRow) => void;
  onDelete: (module: AdvisoryModuleRow) => void;
  onSelect: (module: AdvisoryModuleRow) => void;
  /** Fired when the folder body itself is clicked — opens the module overlay. */
  onOpen: (module: AdvisoryModuleRow) => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Modules">
      <div className="grid items-center gap-2 sm:[grid-template-columns:1fr_auto_1fr]">
        <div className="flex items-center gap-2 sm:justify-self-start">
          <h2 className="m-0 text-sm font-bold tracking-[-0.01em] text-foreground">Modules</h2>
          <Pill tone="blue" label="Submitted modules">{counts.submitted}/{counts.all} submitted</Pill>
        </div>

        {counts.all > 0 ? (
          <div
            role="tablist"
            aria-label="Filter modules by status"
            className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-self-center"
          >
            {(Object.keys(FILTER_LABELS) as (keyof ModuleStatusCounts)[]).map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onFilterChange(key)}
                  className={
                    active
                      ? "inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400"
                      : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  }
                >
                  {FILTER_LABELS[key]}
                  <span className={active ? "text-blue-700/80 dark:text-blue-400/80" : "text-muted-foreground/80"}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
          {headerActions ?? null}
          <Button type="button" className="h-7 px-2.5 text-xs" onClick={onAdd}>
            <Plus size={13} aria-hidden /> Add module
          </Button>
        </div>
      </div>

      {counts.all === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
          <p className="m-0 text-sm font-semibold text-foreground">No modules released yet</p>
          <p className="m-0 max-w-sm text-xs text-muted-foreground">
            Post the module link so your advisees know where to get it, then track their submissions here.
          </p>
          <Button type="button" variant="outline" className="h-7 px-2.5 text-xs" onClick={onAdd}>
            <Plus size={13} aria-hidden /> Release a module
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
          No {FILTER_LABELS[filter].toLowerCase()} modules.
        </p>
      ) : (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {rows.map((m) => {
            const status = STATUS[m.status];
            const StatusIcon = status.icon;
            const selected = selectedId === m.id;
            return (
              <article
                key={m.id}
                onClick={() => onSelect(m)}
                className={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-2.5 transition-colors [font-family:var(--font-inter)] ${
                  selected
                    ? "border-amber-500/60 bg-amber-500/10 dark:bg-amber-500/15"
                    : "border-border bg-muted/60 hover:border-primary/60 hover:shadow dark:bg-muted/20"
                }`}
              >
                <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                    <FileText
                      size={14}
                      aria-hidden
                      className="shrink-0"
                      style={{ color: m.kind === "adm" ? "#8b5cf6" : "#3b82f6" }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(m);
                      }}
                      aria-pressed={selected}
                      className="min-w-0 truncate text-left hover:text-primary hover:underline"
                      title={`Show submissions for ${m.moduleName}`}
                    >
                      {m.moduleName}
                    </button>
                  </span>
                  <Pill tone={status.tone} label="Module status">
                    <StatusIcon size={11} aria-hidden /> {status.label}
                  </Pill>
                </div>

                <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                  <div className="flex w-full justify-center">
                    <span
                      className="w-full max-w-[220px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FolderCard
                        label=""
                        folderColor={m.kind === "adm" ? "#8b5cf6" : "#3b82f6"}
                        onCardClick={() => onOpen(m)}
                        cardAriaLabel={`View ${m.moduleName} details`}
                        files={[
                          {
                            name: m.moduleName,
                            tag: `${m.kind === "adm" ? "ADM" : "General"} · Due ${dateLabel(m.dueDate)}`,
                            tone: 2,
                            icon: "doc",
                          },
                        ]}
                      />
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Pill tone={m.kind === "adm" ? "violet" : "neutral"} label="Module type">
                      {m.kind === "adm" ? "ADM" : "General"}
                    </Pill>
                    <Pill tone="neutral" label="Submissions">
                      {m.kind === "adm"
                        ? `${m.submittedCount}/${m.totalLearners} submitted`
                        : "No tracking"}
                    </Pill>
                    <Pill tone="neutral" label="Released">
                      {dateLabel(m.releaseDate)}
                    </Pill>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {m.moduleUrl ? (
                    <a
                      href={m.moduleUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      title={m.moduleUrl}
                    >
                      <ExternalLink size={12} aria-hidden /> Open link
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No link</span>
                  )}
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => onEdit(m)}
                      aria-label={`Edit ${m.moduleName}`}
                    >
                      <Pencil size={11} aria-hidden /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(m)}
                      aria-label={`Delete ${m.moduleName}`}
                    >
                      <Trash2 size={11} aria-hidden />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} onPageChange={onPageChange} />
    </section>
  );
}
