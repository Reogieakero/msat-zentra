"use client";

import * as React from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { TeacherEmptyCard } from "../../components/TeacherEmptyCard";
import { Button } from "@/components/ui/button";
import { useDock } from "@/components/dock/dock-store";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { ModulesPanel } from "./components/modules-panel";
import { ModuleDetailsOverlay } from "./components/module-details-overlay";
import { ModuleFormDialog } from "./components/module-form-dialog";
import { SubmissionsTable } from "./components/submissions-table";
import {
  modulesExtras,
  submissionsExtras,
  useAdvisoryModules,
  useCreateAdvisoryModule,
  useDeleteAdvisoryModule,
  useModuleSubmissions,
  useUpdateAdvisoryModule,
  type AdvisoryModulePayload,
  type AdvisoryModuleRow,
  type ModuleStatusCounts,
} from "@/services/teacher/advisoryModules.service";

type BoardFilter = keyof ModuleStatusCounts;

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })
    ?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const EMPTY_COUNTS: ModuleStatusCounts = { all: 0, submitted: 0, pending: 0, overdue: 0 };

export default function TeacherAdvisoryModulesPage() {
  const [sectionId, setSectionId] = React.useState<string | undefined>(undefined);
  const [modulePage, setModulePage] = React.useState(1);
  const [moduleFilter, setModuleFilter] = React.useState<BoardFilter>("all");

  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null);
  const [submissionPage, setSubmissionPage] = React.useState(1);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdvisoryModuleRow | null>(null);
  const [deleting, setDeleting] = React.useState<AdvisoryModuleRow | null>(null);
  const [viewing, setViewing] = React.useState<AdvisoryModuleRow | null>(null);

  const modulesQuery = useAdvisoryModules({
    page: modulePage,
    sectionId,
    status: moduleFilter === "all" ? undefined : moduleFilter,
  });
  const extras = modulesExtras(modulesQuery.data);
  const rows = modulesQuery.data?.data ?? [];
  const sections = extras?.sections ?? [];
  const counts = extras?.counts ?? EMPTY_COUNTS;

  // Default the submissions table to the first module on the board; clicking a
  // module name switches it. Derived, so a deleted module falls back cleanly.
  const activeModuleId =
    (selectedModuleId && rows.some((r) => r.id === selectedModuleId) ? selectedModuleId : null) ??
    rows[0]?.id ??
    null;

  const submissionsQuery = useModuleSubmissions({
    moduleId: activeModuleId,
    page: submissionPage,
    enabled: rows.find((r) => r.id === activeModuleId)?.kind === "adm",
  });
  const submissionsExtrasData = submissionsExtras(submissionsQuery.data);
  const submissionRows = submissionsQuery.data?.data ?? [];
  const submissionCounts = submissionsExtrasData?.counts ?? EMPTY_COUNTS;
  const activeModule =
    rows.find((r) => r.id === activeModuleId) ?? null;

  // Keep the open overlay fresh if the module is edited or the page refetches.
  const viewingModule = viewing ? rows.find((r) => r.id === viewing.id) ?? viewing : null;

  const createModule = useCreateAdvisoryModule();
  const updateModule = useUpdateAdvisoryModule();
  const deleteModule = useDeleteAdvisoryModule();
  const dock = useDock();

  const saving = createModule.isPending || updateModule.isPending;

  const handleModuleSubmit = (payload: AdvisoryModulePayload) => {
    const wasEditing = editing !== null;
    const label = payload.moduleName ?? editing?.moduleName ?? "Module";

    // Close first, then report the request in the shared Dock (bottom-right).
    setFormOpen(false);
    setEditing(null);
    const taskId = dock.startTask({
      kind: "generic",
      title: wasEditing ? "Updating module" : "Releasing module",
      description: label,
    });

    const onSuccess = () => {
      dock.completeTask(taskId, wasEditing ? `${label} updated.` : `${label} released.`);
      toast.success({
        title: wasEditing ? "Module updated" : "Module released",
        description: label,
      });
    };
    const onError = (err: unknown) => {
      const message = errorMessage(err, "Try again.");
      dock.failTask(taskId, message);
      toast.error({ title: "Could not save module", description: message });
    };

    if (wasEditing && editing) {
      updateModule.mutate({ moduleId: editing.id, payload }, { onSuccess, onError });
    } else {
      createModule.mutate(
        { ...payload, ...(sectionId ? { sectionId } : {}) },
        { onSuccess, onError },
      );
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;

    // Close first, then report the request in the shared Dock (bottom-right).
    setDeleting(null);
    const taskId = dock.startTask({
      kind: "generic",
      title: "Removing module",
      description: target.moduleName,
    });

    deleteModule.mutate(target.id, {
      onSuccess: () => {
        dock.completeTask(taskId, `${target.moduleName} removed.`);
        toast.success({ title: "Module removed", description: target.moduleName });
        if (selectedModuleId === target.id) setSelectedModuleId(null);
        if (viewing?.id === target.id) setViewing(null);
      },
      onError: (err) => {
        const message = errorMessage(err, "Try again.");
        dock.failTask(taskId, message);
        toast.error({ title: "Could not remove module", description: message });
      },
    });
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
      <TeacherEmptyCard
        centered
        icon={BookOpen}
        title="No advisory section assigned"
        hint="Modules are released to your advisory section. Claim your advisory in Settings, then come back."
        label="Modules"
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <ModulesPanel
        rows={rows}
        counts={counts}
        total={modulesQuery.data?.total ?? 0}
        page={modulePage}
        selectedId={activeModuleId}
        filter={moduleFilter}
        headerActions={
          sections.length > 1 ? (
            <Select
              value={sectionId ?? sections[0]?.id ?? ""}
              onValueChange={(value) => {
                setSectionId(value);
                setModulePage(1);
                setSelectedModuleId(null);
                setSubmissionPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-40 text-xs" aria-label="Advisory section">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
        onFilterChange={(next) => {
          setModuleFilter(next);
          setModulePage(1);
        }}
        onPageChange={setModulePage}
        onAdd={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onEdit={(module) => {
          setEditing(module);
          setFormOpen(true);
        }}
        onDelete={setDeleting}
        onSelect={(module) => {
          setSelectedModuleId(module.id);
          setSubmissionPage(1);
        }}
        onOpen={setViewing}
      />

      {activeModule?.kind === "general" ? (
        <section className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4" aria-label="General module">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-sm font-bold tracking-[-0.01em] text-foreground">General module</h2>
            <Pill tone="neutral" label="Module type">General</Pill>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            &ldquo;{activeModule.moduleName}&rdquo; is a post-only module — it carries no
            submission tracking. Switch to an ADM module to track learners&apos; answers.
          </p>
        </section>
      ) : (
        <SubmissionsTable
          moduleName={activeModule?.moduleName ?? submissionsExtrasData?.module.moduleName ?? "Select a module"}
          rows={submissionRows}
          counts={submissionCounts}
          total={submissionsQuery.data?.total ?? 0}
          page={submissionPage}
          onPageChange={setSubmissionPage}
        />
      )}

      {formOpen ? (
        <ModuleFormDialog
          key={editing?.id ?? "new"}
          module={editing}
          pending={saving}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleModuleSubmit}
        />
      ) : null}

      <ModuleDetailsOverlay
        module={viewingModule}
        onClose={() => setViewing(null)}
        onEdit={(module) => {
          setEditing(module);
          setFormOpen(true);
          setViewing(null);
        }}
        onViewSubmissions={(module) => {
          setSelectedModuleId(module.id);
          setSubmissionPage(1);
          setViewing(null);
        }}
      />

      <KanbanOverlay
        open={!!deleting}
        onClose={() => {
          if (!deleteModule.isPending) setDeleting(null);
        }}
        dismissable={!deleteModule.isPending}
        title="Remove module"
        ariaLabel="Remove module"
        icon={<Trash2 size={16} aria-hidden />}
        description={
          deleting
            ? `Delete "${deleting.moduleName}" and every recorded submission for it?`
            : undefined
        }
        width="sm"
        footer={
          <div className="flex items-center justify-end gap-2 px-1 pb-1">
            <Button
              type="button"
              variant="destructive"
              className="h-6 bg-destructive px-2.5 text-xs text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="m-0 text-xs text-muted-foreground">
          Submissions recorded against this module are removed with it. The audit trail keeps the change.
        </p>
      </KanbanOverlay>
    </div>
  );
}
