"use client";

import * as React from "react";
import { Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AssignAdviserDialog } from "./components/AssignAdviserDialog";
import { ConfirmActionDialog } from "./components/ConfirmActionDialog";
import { SectionsKanban } from "./components/sections-kanban";
import { AssignSkeleton } from "./components/AssignSkeleton";
import { useTerm } from "@/lib/term/TermContext";
import type { AdvisoryEntryInput, GradeLevel, Section } from "@/services/principal/assign.types";
import { useAssignAdvisers, useAssignSectionsData } from "./hooks/useAssignSections";
import { usePrincipalAssignRealtime } from "@/lib/realtime/principalAssignChannel";
import { useDock } from "@/components/dock/dock-store";
import { PrincipalEmptyCard } from "../../components/PrincipalEmptyCard";
import page from "./assign.module.css";

type DialogState = {
  grade: GradeLevel | null;
  sectionId: string;
};

export default function PrincipalAssignPage() {
  const { activeSchoolYear, isLoading: yearsLoading, termReady } = useTerm();
  const schoolYearId = activeSchoolYear?.id ?? "";
  const schoolYearName = activeSchoolYear?.name ?? "";

  const [grade, setGrade] = React.useState<GradeLevel | null>(null);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{ sectionId: string; name: string } | null>(
    null,
  );

  const { sectionsQuery, teachersQuery } = useAssignSectionsData(schoolYearId);

  const { batch, clear, regenerateCode, removeSection, pendingIds } = useAssignAdvisers(
    schoolYearId,
    schoolYearName,
  );
  const dock = useDock();
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const copyCode = React.useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1600);
      toast.success({ title: "Code copied", description: `${code} — share it with the teacher.` });
    } catch {
      toast.error({ title: "Copy failed", description: "Select the code and copy it manually." });
    }
  }, []);

  usePrincipalAssignRealtime(!!schoolYearId && sectionsQuery.isSuccess, schoolYearId, schoolYearName);

  const sections = React.useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const teachers = React.useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);

  const hasNoScope = termReady && !yearsLoading && !schoolYearId;
  const isLoading = !termReady || yearsLoading || (!!schoolYearId && sectionsQuery.isPending);
  const isError = !!schoolYearId && sectionsQuery.isError;

  const retry = () => {
    void sectionsQuery.refetch();
    void teachersQuery.refetch();
  };

  const submitBatch = (entries: AdvisoryEntryInput[]): void => {
    const count = entries.length;
    const scope = schoolYearName || "active school year";
    const gradeLabel = entries[0] ? `Grade ${entries[0].gradeLevel}` : "";
    // Confirming closes the overlay at once — the shared Dock reports the
    // request until it settles.
    const dockId = dock.startTask({
      kind: "generic",
      title: count > 1 ? `Assigning ${count} advisers` : "Assigning adviser",
      description: `${gradeLabel ? `${gradeLabel} · ` : ""}${scope}`,
      total: count,
    });
    batch.mutate(entries, {
      onSuccess: ({ fragments }) =>
        dock.completeTask(
          dockId,
          count > 1
            ? `${fragments.length} advisers assigned`
            : `${fragments[0]?.adviserName ?? "Adviser"} assigned`,
        ),
      onError: () => dock.failTask(dockId, "The advisers weren't saved. Please try again."),
    });
  };

  const openAssign = (section: Section | null) => {
    setDialog({ grade: section ? section.gradeLevel : grade, sectionId: section?.id ?? "" });
  };

  const handleConfirmDelete = (): void => {
    if (!confirmDelete) return;
    const { sectionId, name } = confirmDelete;
    setConfirmDelete(null);
    const dockId = dock.startTask({
      kind: "generic",
      title: "Deleting section",
      description: `${name}${schoolYearName ? ` · ${schoolYearName}` : ""}`,
    });
    removeSection.mutate(sectionId, {
      onSuccess: () => dock.completeTask(dockId, `"${name}" deleted`),
      onError: () => dock.failTask(dockId, `"${name}" wasn't deleted. Please try again.`),
    });
  };

  const boardBusy = batch.isPending || removeSection.isPending || regenerateCode.isPending;

  return (
    <section className={page.page} aria-busy={isLoading}>
      {isLoading ? (
        <AssignSkeleton />
      ) : hasNoScope ? (
        <PrincipalEmptyCard
          icon={Inbox}
          title="No active school year"
          hint="No active school year. Ask the registrar to mark a school year as active."
          centered
        />
      ) : isError ? (
        <div className={page.emptyState} role="alert">
          <TriangleAlert className={page.emptyIcon} aria-hidden />
          <p className={page.emptyTitle}>Unable to load assignments</p>
          <p className={page.emptyText}>
            Sections for {schoolYearName || "the active school year"} could not be loaded.
          </p>
          <Button onClick={retry}>Retry</Button>
        </div>
      ) : (
        <SectionsKanban
          sections={sections}
          grade={grade}
          onGradeChange={setGrade}
          pendingIds={pendingIds}
          busy={boardBusy}
          copiedCode={copiedCode}
          onCopyCode={(code) => void copyCode(code)}
          onAssign={openAssign}
          onClear={(sectionId) => clear.mutate(sectionId)}
          onRegenerate={(sectionId) => regenerateCode.mutate(sectionId)}
          onDelete={(section) => setConfirmDelete({ sectionId: section.id, name: section.name })}
          onCreate={() => openAssign(null)}
        />
      )}

      {dialog ? (
        <AssignAdviserDialog
          sections={sections}
          teachers={teachers}
          schoolYearName={schoolYearName}
          initialGrade={dialog.grade}
          initialSectionId={dialog.sectionId}
          isAssigning={batch.isPending}
          onClose={() => setDialog(null)}
          onSubmit={submitBatch}
          onAssigned={() => setDialog(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmActionDialog
          title="Delete section?"
          description={`"${confirmDelete.name}" will be permanently deleted. This is only allowed while it has no students or records.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </section>
  );
}
