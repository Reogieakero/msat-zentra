"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import type { AdmMonitoringCase } from "@/services/teacher/admMonitoring.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function MonitoringProgress({
  progress,
}: {
  progress: AdmMonitoringCase["progress"];
}) {
  const { submitted, total, percent, overdueCount, nextDueAt } = progress;
  const remaining = Math.max(0, total - submitted);

  const stats = [
    {
      label: "Modules submitted",
      value: `${submitted}/${total}`,
      hint: total === 0 ? "No modules released yet" : `${remaining} to go`,
      icon: ListChecks,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Completion",
      value: `${percent}%`,
      hint: total === 0 ? "Waiting for module release" : percent === 100 ? "All modules in" : "Of released modules",
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Overdue",
      value: String(overdueCount),
      hint: overdueCount === 0 ? "Nothing past due" : "Past the due date",
      icon: AlertTriangle,
      tone: overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
    },
    {
      label: "Next due",
      value: dateLabel(nextDueAt),
      hint: nextDueAt ? "Earliest pending module" : "No pending deadlines",
      icon: CalendarClock,
      tone: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4" aria-label="Module progress">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 rounded-md border bg-background px-3 py-2">
            <p className="m-0 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon size={12} className={tone} aria-hidden /> {label}
            </p>
            <p className="m-0 truncate text-base font-bold text-foreground" title={value}>
              {value}
            </p>
            <p className="m-0 truncate text-[11px] text-muted-foreground" title={hint}>
              {hint}
            </p>
          </div>
        ))}
      </div>
      <div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Module completion"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        {total === 0 ? (
          <p className="m-0 mt-1 text-[11px] text-muted-foreground">
            No modules yet — release one from the advisory Modules desk.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill tone="blue" label="Modules submitted">
              {submitted} of {total} modules submitted
            </Pill>
            <Pill tone="green" label="Completion">
              {percent}% complete
            </Pill>
          </div>
        )}
      </div>
    </section>
  );
}
