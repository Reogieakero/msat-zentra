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
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDock } from "@/components/dock/dock-store";
import { Pagination } from "@/components/shared/pagination";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  studentModulesExtras,
  useStudentModules,
  useSubmitStudentLink,
  useSubmitStudentPhysical,
  useUploadStudentSubmission,
  type StudentFilterStatus,
  type StudentModuleCounts,
  type StudentModuleRow,
  type StudentModuleStatus,
} from "@/services/student/modules.service";
import { StudentSubmitDialog, type StudentSubmitPayload } from "./components/submit-dialog";

const STATUS: Record<
  StudentModuleStatus,
  { label: string; tone: PillTone; icon: typeof CheckCircle2 }
> = {
  submitted: { label: "Submitted", tone: "green", icon: CheckCircle2 },
  pending: { label: "Pending", tone: "amber", icon: Clock3 },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  posted: { label: "Posted", tone: "blue", icon: Megaphone },
};

const FILTERS: { key: "all" | StudentFilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "To do" },
  { key: "submitted", label: "Submitted" },
  { key: "overdue", label: "Overdue" },
];

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })
    ?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function ModuleCard({
  module,
  onSubmit,
}: {
  module: StudentModuleRow;
  onSubmit: (module: StudentModuleRow) => void;
}) {
  const status = STATUS[module.status];
  const StatusIcon = status.icon;
  const trackable = module.kind === "adm";
  const accent = module.kind === "adm" ? "#8b5cf6" : "#3b82f6";

  return (
    <article
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 transition-colors hover:border-primary/60 hover:shadow dark:bg-muted/20"
      aria-label={`${module.moduleName}, ${status.label}`}
    >
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <FileText size={14} aria-hidden className="shrink-0" style={{ color: accent }} />
          <span className="truncate" title={module.moduleName}>
            {module.moduleName}
          </span>
        </span>
        <Pill tone={status.tone} label="Module status">
          <StatusIcon size={11} aria-hidden /> {status.label}
        </Pill>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone={module.kind === "adm" ? "violet" : "neutral"} label="Module type">
            {module.kind === "adm" ? "ADM" : "General"}
          </Pill>
          <Pill tone="neutral" label="Due date">
            <CalendarClock size={11} aria-hidden /> Due {dateLabel(module.dueDate)}
          </Pill>
        </div>

        {module.description ? (
          <p className="m-0 line-clamp-3 break-words text-[11px] leading-relaxed text-muted-foreground">
            {module.description}
          </p>
        ) : null}

        {module.moduleUrl ? (
          <a
            href={module.moduleUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            title={module.moduleUrl}
          >
            <ExternalLink size={12} className="shrink-0" aria-hidden />
            <span className="truncate">Open module</span>
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground">No module link posted</span>
        )}

        {trackable ? (
          <div className="flex min-w-0 flex-col gap-0.5 border-t border-border/60 pt-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Your answer
            </span>
            {module.submitted && module.submissionKind === "link" && module.submissionUrl ? (
              <a
                href={module.submissionUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                title={module.submissionUrl}
              >
                <ExternalLink size={12} className="shrink-0" aria-hidden />
                <span className="truncate">Submitted link</span>
              </a>
            ) : module.submitted && module.submissionKind === "file" && module.fileUrl ? (
              <a
                href={module.fileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                title={module.fileUrl}
              >
                <ExternalLink size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{module.fileName ?? "Submitted file"}</span>
              </a>
            ) : module.submitted && module.submissionKind === "physical" ? (
              <span className="inline-flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-foreground">
                <Users size={11} aria-hidden /> Passed in person
                {module.fileUrl ? (
                  <a
                    href={module.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-primary hover:underline"
                  >
                    · View proof
                  </a>
                ) : null}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Nothing handed in yet</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {module.submitted
                ? `Submitted ${dateLabel(module.submittedAt)}`
                : `Released ${dateLabel(module.releaseDate)}`}
            </span>
          </div>
        ) : (
          <p className="m-0 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            Post-only module — nothing to hand in.
          </p>
        )}
      </div>

      {trackable ? (
        <div className="flex items-center justify-end px-0.5">
          <Button
            type="button"
            variant={module.submitted ? "outline" : "default"}
            className="h-6 px-2.5 text-[11px]"
            onClick={() => onSubmit(module)}
            aria-label={`Submit ${module.moduleName}`}
          >
            <Upload size={11} aria-hidden /> {module.submitted ? "Update answer" : "Submit answer"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

const EMPTY_COUNTS: StudentModuleCounts = { all: 0, submitted: 0, pending: 0, overdue: 0 };

export default function StudentModulesPage() {
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState<"all" | StudentFilterStatus>("all");
  const [submitting, setSubmitting] = React.useState<StudentModuleRow | null>(null);

  const modulesQuery = useStudentModules({
    page,
    status: filter === "all" ? undefined : filter,
  });
  const extras = studentModulesExtras(modulesQuery.data);
  const rows = modulesQuery.data?.data ?? [];
  const counts = extras?.counts ?? EMPTY_COUNTS;
  const section = extras?.section ?? null;

  const submitLink = useSubmitStudentLink();
  const submitPhysical = useSubmitStudentPhysical();
  const uploadSubmission = useUploadStudentSubmission();
  const dock = useDock();

  const pending =
    submitLink.isPending || submitPhysical.isPending || uploadSubmission.isPending;

  const handleSubmit = (payload: StudentSubmitPayload) => {
    if (!submitting) return;
    const target = submitting;
    // Close first, then report the request in the shared Dock (bottom-right).
    setSubmitting(null);
    const taskId = dock.startTask({
      kind: "generic",
      title: "Submitting module",
      description: target.moduleName,
    });

    const onSuccess = () => {
      dock.completeTask(taskId, `${target.moduleName} submitted.`);
      toast.success({ title: "Submission saved", description: target.moduleName });
    };
    const onError = (err: unknown) => {
      const message = errorMessage(err, "Try again.");
      dock.failTask(taskId, message);
      toast.error({ title: "Could not submit module", description: message });
    };

    if (payload.kind === "link" && payload.submissionUrl) {
      submitLink.mutate(
        {
          moduleId: target.id,
          submissionUrl: payload.submissionUrl,
          remarks: payload.remarks ?? null,
        },
        { onSuccess, onError },
      );
      return;
    }
    if (payload.file) {
      uploadSubmission.mutate(
        {
          moduleId: target.id,
          kind: payload.kind === "physical" ? "physical" : "file",
          file: payload.file,
          remarks: payload.remarks ?? null,
        },
        { onSuccess, onError },
      );
      return;
    }
    submitPhysical.mutate(target.id, { onSuccess, onError });
  };

  if (modulesQuery.isPending && !modulesQuery.data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading modules">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (modulesQuery.isError && !modulesQuery.data) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center">
        <p className="m-0 text-sm font-semibold text-foreground">Could not load your modules</p>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {errorMessage(modulesQuery.error, "Check your connection and try again.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-3" aria-label="My modules">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-base font-bold tracking-[-0.01em] text-foreground">My modules</h1>
            {section ? (
              <Pill tone="neutral" label="Your section">
                {section.name} · {section.gradeLevel}
              </Pill>
            ) : null}
          </div>
          <Pill tone="blue" label="Submitted modules">
            {counts.submitted}/{counts.all} submitted
          </Pill>
        </div>

        {extras?.learner ? (
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
            <StudentMascot
              name={extras.learner.name}
              seed={extras.learner.lrn}
              character={extras.learner.mascot ?? undefined}
              size={40}
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {extras.learner.name}
              </span>
              <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                LRN {extras.learner.lrn}
              </span>
            </span>
          </div>
        ) : null}

        {counts.all > 0 ? (
          <div role="tablist" aria-label="Filter modules by status" className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              const value = key === "all" ? counts.all : counts[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(key);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {label}
                  <span className={active ? "text-primary/80" : "text-muted-foreground/80"}>{value}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!section ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
            <p className="m-0 text-sm font-semibold text-foreground">No section assigned yet</p>
            <p className="m-0 max-w-sm text-xs text-muted-foreground">
              Your modules appear here once the registrar places you in a section. Ask your adviser
              if this looks wrong.
            </p>
          </div>
        ) : counts.all === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
            <p className="m-0 text-sm font-semibold text-foreground">No modules released yet</p>
            <p className="m-0 max-w-sm text-xs text-muted-foreground">
              When your adviser releases a module, it shows up here with its deadline.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <p className="m-0 rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
            Nothing in this filter.
          </p>
        ) : (
          <div
            className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]"
            role="list"
            aria-label="Released modules"
          >
            {rows.map((module) => (
              <div key={module.id} role="listitem" className="min-w-0">
                <ModuleCard module={module} onSubmit={setSubmitting} />
              </div>
            ))}
          </div>
        )}

        <Pagination
          currentPage={modulesQuery.data?.page ?? page}
          totalItems={modulesQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </section>

      {submitting ? (
        <StudentSubmitDialog
          key={submitting.id}
          module={submitting}
          pending={pending}
          onClose={() => setSubmitting(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
