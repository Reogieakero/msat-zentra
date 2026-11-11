"use client";

import * as React from "react";
import {
  ArchiveRestore,
  Loader2,
  Pencil,
  Plus,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { anecdotalCategoryBadgeVariant } from "@/lib/labels/anecdotal";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Badge } from "@/components/ui/badge";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import {
  deleteAnecdotalRecord,
  type MyAnecdotalRecord,
} from "@/components/ocform01/folders";
import styles from "./anecdotal-repo-folders.module.css";
import { AnecdotalArchiveDialog } from "./AnecdotalArchiveDialog";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { SharedTermPill } from "@/components/shared/shared-term-pill";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function AnecdotalRepoFolders({
  records,
  toolbarActions,
}: {
  records: MyAnecdotalRecord[];
  toolbarActions?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [page, setPage] = React.useState(1);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<MyAnecdotalRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deletedOpen, setDeletedOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const deleteDockTaskRef = React.useRef<string | null>(null);

  function refreshRecords() {
    void queryClient.invalidateQueries({ queryKey: ["anecdotal-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["anecdotal-deleted"] });
  }

  async function handleDelete(entry: MyAnecdotalRecord) {
    if (deleting) return;
    // Close the confirm overlay as soon as the teacher confirms — the record
    // disappears from the grid once the request lands, and any failure is
    // reported by toast instead of leaving the dialog stuck on "Deleting…".
    setDeleting(true);
    setDeleteTarget(null);
    setPreviewId(null);
    deleteDockTaskRef.current = dock.startTask({
      kind: "generic",
      title: "Deleting record",
      description: `${entry.studentName} · ${humanizeCategory(entry.category)}`,
    });
    try {
      await deleteAnecdotalRecord(entry.id);
      refreshRecords();
      if (deleteDockTaskRef.current) {
        dock.completeTask(
          deleteDockTaskRef.current,
          "Record moved to Archive records — restore any time.",
        );
        deleteDockTaskRef.current = null;
      }
      toast.success({
        title: "Record deleted",
        description: "You can restore it any time from Archive records.",
      });
    } catch (e) {
      const message =
        (e as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data
          ?.error?.message;
      const description =
        typeof message === "string" && message.trim()
          ? message
          : "Check your connection and try again.";
      if (deleteDockTaskRef.current) {
        dock.failTask(deleteDockTaskRef.current, description);
        deleteDockTaskRef.current = null;
      }
      toast.error({ title: "Could not delete record", description });
    } finally {
      setDeleting(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return records;
    return records.filter(
      (c) =>
        c.studentName.toLowerCase().includes(needle) ||
        c.lrn.toLowerCase().includes(needle) ||
        c.section.toLowerCase().includes(needle),
    );
  }, [records, needle]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className={`${styles.panel} flex flex-1 flex-col`}>
        <div className="flex w-full flex-wrap items-center gap-2 pt-1">
          <InputGroup className="h-9 w-full max-w-56 shrink-0 rounded-full">
            <InputGroupInput
              className="h-full py-0 text-sm"
              placeholder="Search folders…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search folders"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 shrink-0 rounded-full px-2 text-xs"
              onClick={() => setDeletedOpen(true)}
            >
              <ArchiveRestore size={14} aria-hidden />
              Archive records
            </Button>
            {toolbarActions}
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.scrollArea}>
          {records.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No filed records yet</p>
              <p className={styles.emptyBody}>
                File your first anecdotal record with Bama and it will land here.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  window.open("/teacher/chat?standalone=1&new=anecdotal", "_blank", "noopener,noreferrer")
                }
              >
                <Plus aria-hidden />
                New record
              </Button>
            </div>
          ) : pageRows.length === 0 && needle ? (
            <div className="flex w-full justify-center px-1 py-10">
              <InsightCallout role="status" className="w-full max-w-xl text-left">
                <strong>No folders match “{query}”.</strong> Try a different name,
                LRN, or section — or clear the search to see every filed record.
              </InsightCallout>
            </div>
          ) : pageRows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No filed records on this page</p>
              <p className={styles.emptyBody}>
                File your first anecdotal record with Bama and it will land here.
              </p>
            </div>
          ) : (
            <div className={styles.folderGrid}>
              {pageRows.map((c) => (
                <AnecdotalRecordKanbanCard
                  key={c.id}
                  category={c.category}
                  studentName={c.studentName}
                  mascotSeed={c.lrn}
                  mascotCharacter={c.mascot ?? undefined}
                  mascotSize={44}
                  metaText={c.lrn}
                  metaTitle={`${c.lrn} · ${c.section}`}
                  fileName={`GCForm-01_${recordDate(c.observationDatetime)}`}
                  fileTag={`${humanizeCategory(c.category)} - ${timeAgo(c.observationDatetime)}`}
                  headerRight={
                    <span className="flex shrink-0 items-center gap-1.5">
                      {c.edited ? (
                        <Pill
                          tone="teal"
                          label="Edited after filing — this record is no longer the original."
                        >
                          Edited
                        </Pill>
                      ) : null}
                      <SharedTermPill termNumber={c.termNumber} action="Filed" />
                      {c.signed ? (
                        <Badge variant="green" className="shrink-0 rounded-md">
                          Signed
                        </Badge>
                      ) : null}
                    </span>
                  }
                  openLabel={`Open ${c.studentName}'s record from ${recordDate(c.observationDatetime)}`}
                  onOpen={() => setPreviewId(c.id)}
                  actions={
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-6 gap-1 px-2 text-xs"
                        aria-label={`Edit record context for ${c.studentName}`}
                        onClick={() => {
                          setPreviewId(null);
                          window.open(
                            `/teacher/chat?standalone=1&new=anecdotal&edit=${encodeURIComponent(c.id)}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        <Pencil size={13} aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-6 gap-1 px-2 text-xs bg-red-600 text-white hover:bg-red-700"
                        aria-label={`Delete record for ${c.studentName}`}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 size={13} aria-hidden />
                        Delete
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
          </div>
          <Pagination
            currentPage={safePage}
            totalItems={visible.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <KanbanOverlay
        open={deleteTarget !== null && !deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        width="sm"
        title="Delete this record?"
        icon={
          <span className="text-destructive" aria-hidden>
            <Trash2 size={14} />
          </span>
        }
        description="The record is hidden from this desk but kept in Archive records, where you can restore it any time."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-6 gap-1 px-2 text-xs bg-red-600 text-white hover:bg-red-700"
              disabled={deleting || !deleteTarget}
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
            >
              {deleting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={14} aria-hidden />
              )}
              {deleting ? "Deleting…" : "Delete record"}
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 items-center gap-3 px-1">
          {deleteTarget ? (
            <StudentMascot
              name={deleteTarget.studentName}
              seed={deleteTarget.lrn}
              character={deleteTarget.mascot ?? undefined}
              size={36}
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[13px] font-semibold text-primary">
              {deleteTarget?.studentName ?? "Record"}
            </p>
            <span className="flex flex-wrap items-center gap-1">
              <Pill tone="neutral" label="LRN">
                {deleteTarget?.lrn ?? "—"}
              </Pill>
              <Pill
                tone={
                  deleteTarget
                    ? (anecdotalCategoryBadgeVariant(deleteTarget.category) ?? "neutral")
                    : "neutral"
                }
                label="Category"
              >
                {deleteTarget ? humanizeCategory(deleteTarget.category) : "—"}
              </Pill>
              <Pill tone="neutral" label="Filed">
                {deleteTarget ? recordDate(deleteTarget.observationDatetime) : "—"}
              </Pill>
              <Pill
                tone={deleteTarget?.edited ? "teal" : "neutral"}
                label={
                  deleteTarget?.edited
                    ? "This record has been edited since it was filed."
                    : "This is the original record — it has not been edited."
                }
              >
                {deleteTarget?.edited ? "Edited" : "Original"}
              </Pill>
            </span>
          </div>
        </div>
      </KanbanOverlay>

      <AnecdotalArchiveDialog open={deletedOpen} onClose={() => setDeletedOpen(false)} />
    </>
  );
}
