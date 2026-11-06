"use client";

import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Megaphone,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill, type PillTone } from "@/components/ui/pill";
import type {
  AdvisoryModuleRow,
  AdvisoryModuleStatus,
} from "@/services/teacher/advisoryModules.service";

const STATUS: Record<
  AdvisoryModuleStatus,
  { label: string; tone: PillTone; Icon: typeof CheckCircle2 }
> = {
  submitted: { label: "Submitted", tone: "green", Icon: CheckCircle2 },
  pending: { label: "Pending", tone: "amber", Icon: Clock3 },
  overdue: { label: "Overdue", tone: "red", Icon: TriangleAlert },
  posted: { label: "Posted", tone: "blue", Icon: Megaphone },
};

const KIND_COLOR: Record<AdvisoryModuleRow["kind"], string> = {
  adm: "#8b5cf6",
  general: "#3b82f6",
};

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Small bordered metric tile used across the details sheet. */
function StatTile({
  icon,
  label,
  value,
  caption,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  caption?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </span>
      <span className="truncate text-[13px] font-semibold text-foreground">{value}</span>
      {caption ? <span className="text-[10px] text-muted-foreground">{caption}</span> : null}
      {children}
    </div>
  );
}

/** Bordered detail row (label left, value right). */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[12px] font-semibold text-foreground">{children}</span>
    </div>
  );
}

export function ModuleDetailsOverlay({
  module,
  onClose,
  onEdit,
  onViewSubmissions,
}: {
  module: AdvisoryModuleRow | null;
  onClose: () => void;
  onEdit: (module: AdvisoryModuleRow) => void;
  onViewSubmissions: (module: AdvisoryModuleRow) => void;
}) {
  const status = module ? STATUS[module.status] : null;
  const StatusIcon = status?.Icon;
  const tracked = module?.kind === "adm";
  const total = module?.totalLearners ?? 0;
  const submitted = module?.submittedCount ?? 0;
  const pct = tracked && total > 0 ? Math.round((submitted / total) * 100) : 0;
  const accent = module ? KIND_COLOR[module.kind] : undefined;

  return (
    <KanbanOverlay
      open={!!module}
      onClose={onClose}
      title="Module details"
      ariaLabel={module ? `Module details for ${module.moduleName}` : "Module details"}
      icon={<FileText size={16} aria-hidden />}
      width="lg"
      footer={
        module ? (
          <div className="flex flex-wrap items-center justify-end gap-2 px-1 pb-1">
            {tracked ? (
              <Button
                type="button"
                className="h-6 px-2.5 text-xs"
                onClick={() => onViewSubmissions(module)}
              >
                View submissions
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-6 px-2.5 text-xs"
              onClick={() => onEdit(module)}
            >
              Edit module
            </Button>
          </div>
        ) : null
      }
    >
      {module && status ? (
        <div className="flex min-w-0 flex-col gap-3 px-1 pb-1">
          {/* Hero: identity + the two things a teacher scans first. */}
          <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-white p-3 shadow-sm dark:bg-card">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white shadow-sm"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              <FileText size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h3 className="m-0 min-w-0 break-words text-[13px] font-semibold text-foreground">
                  {module.moduleName}
                </h3>
                <Pill tone={module.kind === "adm" ? "violet" : "neutral"} label="Module type">
                  {module.kind === "adm" ? "ADM" : "General"}
                </Pill>
                <Pill tone={status.tone} label="Module status">
                  {StatusIcon ? <StatusIcon size={11} aria-hidden /> : null} {status.label}
                </Pill>
              </div>
              <p className="m-0 text-[11px] text-muted-foreground">
                Released {dateLabel(module.releaseDate)} · Due {dateLabel(module.dueDate)}
              </p>
            </div>
          </div>

          {/* Metrics: submissions, progress, deadline. */}
          <div className="grid gap-2 sm:grid-cols-3">
            <StatTile
              icon={<Users size={11} aria-hidden />}
              label="Submissions"
              value={tracked ? `${submitted}/${total}` : "Not tracked"}
              caption={tracked ? "Learners who handed it in" : "General post only"}
            />
            <StatTile
              icon={<CheckCircle2 size={11} aria-hidden />}
              label="Progress"
              value={tracked ? `${pct}%` : "—"}
              caption={tracked ? `${Math.max(0, total - submitted)} still pending` : "No submission tracking"}
            >
              {tracked ? (
                <div
                  className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Submission progress"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-150 ${
                      pct >= 100 ? "bg-emerald-500" : "bg-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </StatTile>
            <StatTile
              icon={<CalendarClock size={11} aria-hidden />}
              label="Due date"
              value={dateLabel(module.dueDate)}
              caption={module.dueDate ? "Deadline for the section" : "No deadline set"}
            />
          </div>

          {/* Recap + instructions, in the same two-column rhythm as a desk card. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
              <h4 className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Overview
              </h4>
              <DetailRow label="Type">{module.kind === "adm" ? "ADM module" : "General post"}</DetailRow>
              <DetailRow label="Status">{status.label}</DetailRow>
              <DetailRow label="Released">{dateLabel(module.releaseDate)}</DetailRow>
              <DetailRow label="Due">{dateLabel(module.dueDate)}</DetailRow>
            </div>

            <div className="flex min-w-0 flex-col rounded-lg border border-border bg-white p-2.5 shadow-sm dark:bg-card">
              <h4 className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Module link
              </h4>
              {module.moduleUrl ? (
                <a
                  href={module.moduleUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex min-w-0 items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 text-[11px] font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                  title={module.moduleUrl}
                >
                  <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 break-all">{module.moduleUrl}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground group-hover:text-primary">
                    Open
                  </span>
                </a>
              ) : (
                <p className="m-0 rounded-md border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                  No link posted for this module yet.
                </p>
              )}
              <h4 className="m-0 mb-1 mt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Instructions
              </h4>
              <p className="m-0 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground">
                {module.description?.trim() || "No instructions were added to this module."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
