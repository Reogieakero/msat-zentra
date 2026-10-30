"use client";

import * as React from "react";
import { CheckCircle2, Clock3, ExternalLink, FileText, Pencil, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { AdmMonitoredModule } from "@/services/teacher/admMonitoring.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const STATUS: Record<AdmMonitoredModule["status"], { label: string; tone: PillTone; icon: typeof CheckCircle2 }> = {
  submitted: { label: "Submitted", tone: "green", icon: CheckCircle2 },
  pending: { label: "Pending", tone: "amber", icon: Clock3 },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
};

const FILTER_LABELS = {
  all: "All",
  submitted: "Submitted",
  pending: "Pending",
  overdue: "Overdue",
} as const;

export function ModulesPanel({
  modules,
  onEdit,
}: {
  modules: AdmMonitoredModule[];
  onEdit: (module: AdmMonitoredModule) => void;
}) {
  const submitted = modules.filter((m) => m.submitted).length;
  const [filter, setFilter] = React.useState<"all" | "submitted" | "pending" | "overdue">(
    "all"
  );

  const counts = {
    all: modules.length,
    submitted,
    pending: modules.filter((m) => m.status === "pending").length,
    overdue: modules.filter((m) => m.status === "overdue").length,
  };
  const visible =
    filter === "all"
      ? modules
      : filter === "submitted"
        ? modules.filter((m) => m.submitted)
        : modules.filter((m) => m.status === filter);

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" aria-label="Modules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-bold tracking-[-0.01em] text-foreground">Modules</h2>

        {modules.length > 0 ? (
          <div
            role="tablist"
            aria-label="Filter modules by status"
            className="flex flex-wrap items-center justify-end gap-1.5"
          >
            {(Object.keys(counts) as (keyof typeof counts)[]).map((key) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(key)}
                  className={
                    active
                      ? "inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400"
                      : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  }
                >
                  {FILTER_LABELS[key]}
                  <span
                    className={
                      active
                        ? "text-blue-700/70 dark:text-blue-400/70"
                        : "text-muted-foreground/80"
                    }
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
          <p className="m-0 text-sm font-semibold text-foreground">No modules released yet</p>
          <p className="m-0 max-w-sm text-xs text-muted-foreground">
            Post an ADM module from the advisory Modules desk and its submissions will show up
            here.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
          No {FILTER_LABELS[filter].toLowerCase()} modules.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Module</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Released</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Due</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Status</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Submitted on</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">Module link</th>
                <th scope="col" className="border-b px-2 py-1.5 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const status = STATUS[m.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={m.id} className="align-top hover:bg-muted/40">
                    <td className="max-w-[16rem] border-b px-2 py-2">
                      <p className="m-0 truncate font-semibold text-foreground" title={m.moduleName}>
                        {m.moduleName}
                      </p>
                      <Pill
                        tone={m.source === "section" ? "violet" : "neutral"}
                        label="Module source"
                      >
                        {m.source === "section" ? "Section ADM" : "Case"}
                      </Pill>
                    </td>
                    <td className="whitespace-nowrap border-b px-2 py-2 text-muted-foreground">
                      {dateLabel(m.releaseDate)}
                    </td>
                    <td className="whitespace-nowrap border-b px-2 py-2 text-muted-foreground">
                      {dateLabel(m.dueDate)}
                    </td>
                    <td className="whitespace-nowrap border-b px-2 py-2">
                      <Pill tone={status.tone} label="Module status">
                        <StatusIcon size={11} aria-hidden /> {status.label}
                      </Pill>
                    </td>
                    <td className="whitespace-nowrap border-b px-2 py-2 text-muted-foreground">
                      {m.submitted ? dateLabel(m.submissionDate) : "—"}
                    </td>
                    <td className="border-b px-2 py-2">
                      {m.submissionUrl ? (
                        <a
                          href={m.submissionUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          title={m.submissionUrl}
                        >
                          <ExternalLink size={12} aria-hidden /> Open link
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No link</span>
                      )}
                      {m.fileUrl ? (
                        <a
                          href={m.fileUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 flex items-center gap-1 font-medium text-primary hover:underline"
                          title={m.fileUrl}
                        >
                          <FileText size={12} aria-hidden /> {m.fileName ?? "Answered file"}
                        </a>
                      ) : null}
                      {m.studentSubmissionUrl && m.studentSubmissionUrl !== m.submissionUrl ? (
                        <a
                          href={m.studentSubmissionUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 flex items-center gap-1 font-medium text-primary hover:underline"
                          title={m.studentSubmissionUrl}
                        >
                          <ExternalLink size={12} aria-hidden /> Answered link
                        </a>
                      ) : null}
                    </td>
                    <td className="border-b px-2 py-2 text-right">
                      {m.source === "section" ? (
                        <span
                          className="text-[11px] text-muted-foreground"
                          title="Edit this module from the advisory Modules desk"
                        >
                          Modules desk
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => onEdit(m)}
                          aria-label={`Edit ${m.moduleName}`}
                        >
                          <Pencil size={11} aria-hidden /> Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
