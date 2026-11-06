"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Images, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { useDock } from "@/components/dock/dock-store";
import { apiErrorMessage } from "@/lib/api/errors";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { toast } from "@/components/ui/sonner";
import {
  clinicAttachmentError,
  deleteClinicAttachment,
  uploadClinicAttachments,
} from "@/services/nurse/sessions.service";
import type {
  ClinicAttachment,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import { invalidateNurseQueries } from "../../overview/components/use-nurse-mutation";
import { useActiveNowTick } from "@/lib/clock";
import type { DialogProps } from "./NurseSessionDialogs";
import styles from "./NurseReferralDialogs.module.css";

/**
 * Clinic session documentation — the same KanbanBoard overlay design as the
 * other nurse confirmations (shared shell + filed-photos board + attach board,
 * 24px footer buttons). Filing or removing a photo hands the request to the
 * shared Dock and closes the overlay at once, so a slow request never leaves
 * it stuck.
 */
export function SessionDocsDialog({
  referralId,
  session,
  open,
  onClose,
  onConfirmed,
  onChanged,
}: DialogProps & {
  referralId: string;
  session: NurseSessionItem;
  /** Fired the moment the request is handed off — the page closes the Clinic
      sessions board too and the Dock reports the outcome. */
  onConfirmed: () => void;
}) {
  const dock = useDock();
  const queryClient = useQueryClient();
  const [docs] = React.useState<ClinicAttachment[]>(session.attachments ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = `nurse-docs-${session.id}`;
  const now = useActiveNowTick(open);

  // Escape closes the overlay — the same affordance as the other kanban
  // overlays (the backdrop button covers pointer users).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onClose();
      setError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const docsLocked =
    session.status === "scheduled" && new Date(session.scheduledAt).getTime() > now;

  const displayError = error;

  function closeDocs() {
    onClose();
    setError(null);
  }

  /* Picking photos closes the overlay immediately and files them through the
     bottom-right Dock — the same hand-off the move/cancel sessions use. */
  function handOffUpload(picked: File[]) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Uploading session photos",
        description: `${session.date} · ${picked.length} photo${picked.length === 1 ? "" : "s"}`,
        total: picked.length,
      });
    } catch {
      taskId = null;
    }
    closeDocs();
    onConfirmed();
    void (async () => {
      try {
        const added = await uploadClinicAttachments(referralId, session.id, picked);
        markSelfNotified(referralId);
        invalidateNurseQueries(queryClient, "alerts");
        toast.success({
          title: "Photos filed",
          description: `${added.length} photo${added.length === 1 ? "" : "s"} attached to this session.`,
        });
        onChanged();
        if (taskId) {
          dock.completeTask(
            taskId,
            `${added.length} photo${added.length === 1 ? "" : "s"} filed`,
          );
        }
      } catch (err) {
        if (taskId) {
          dock.failTask(
            taskId,
            apiErrorMessage(err, "Could not upload the photos. Try again."),
          );
        }
      }
    })();
  }

  /* Removing follows the same hand-off: the Dock carries the delete and the
     overlay closes at once. */
  function handOffRemove(doc: ClinicAttachment) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Removing session photo",
        description: doc.fileName,
      });
    } catch {
      taskId = null;
    }
    closeDocs();
    onConfirmed();
    void (async () => {
      try {
        await deleteClinicAttachment(referralId, session.id, doc.id);
        markSelfNotified(referralId);
        invalidateNurseQueries(queryClient, "alerts");
        toast.success({
          title: "Photo removed",
          description: "The photo was removed from this session.",
        });
        onChanged();
        if (taskId) dock.completeTask(taskId, "Photo removed");
      } catch (err) {
        if (taskId) {
          dock.failTask(
            taskId,
            apiErrorMessage(err, "Could not remove that photo. Try again."),
          );
        }
      }
    })();
  }

  function onPick(list: FileList | null) {
    if (!list) return;
    if (docsLocked) {
      setError("This session hasn't started yet — you can file documentation once the scheduled time arrives.");
      return;
    }
    const picked = Array.from(list).slice(0, 5);
    const problem = clinicAttachmentError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    handOffUpload(picked);
  }

  function onRemove(doc: ClinicAttachment) {
    setError(null);
    handOffRemove(doc);
  }

  return (
    <div
      className="whitespace-normal fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Session documentation"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={closeDocs}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-2xl">
        <KanbanBoard
          className={`bg-card max-h-[90vh] overflow-y-auto shadow-2xl ${styles.dialogScrollHidden}`}
          title="Session documentation"
          icon={
            <span className="text-primary" aria-hidden>
              <Paperclip size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={closeDocs}
              autoFocus
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description="Optional photos for this session — wound, slip, lab result… JPG/PNG/WEBP, 5 MB each."
          footer={
            /* 24px action button — same metric as the kanban boards. */
            <div className="flex flex-wrap items-center justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={closeDocs}
              >
                Done
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 px-1 pb-1">
            <KanbanBoard
              title="Filed photos"
              icon={
                <span className="text-muted-foreground" aria-hidden>
                  <Images size={14} />
                </span>
              }
              count={docs.length}
            >
              {docs.length === 0 ? (
                <KanbanBoardEmpty>No photos filed yet.</KanbanBoardEmpty>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-3 md:grid-cols-4">
                  {docs.map((d) => (
                    <figure
                      key={d.id}
                      className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card"
                    >
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                        aria-label={`Open ${d.fileName}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.fileUrl}
                          alt={d.fileName}
                          className="h-24 w-full object-cover"
                        />
                      </a>
                      <figcaption className="flex items-center justify-between gap-1 border-t border-border px-2 py-1">
                        <span
                          className="truncate text-[11px] text-muted-foreground"
                          title={d.fileName}
                        >
                          {d.fileName}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 shrink-0 px-1.5 text-xs"
                          onClick={() => void onRemove(d)}
                          aria-label={`Remove ${d.fileName}`}
                        >
                          Remove
                        </Button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </KanbanBoard>
            <KanbanBoard
              title="Attach photos (optional)"
              icon={
                <span className="text-muted-foreground" aria-hidden>
                  <Paperclip size={14} />
                </span>
              }
              description={
                docsLocked
                  ? "This session hasn't started yet — filing unlocks once the scheduled time arrives."
                  : "Up to 5 images at a time."
              }
            >
              <div className="flex items-center gap-2 px-1 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-3 text-xs"
                  disabled={docsLocked}
                  onClick={() => inputRef.current?.click()}
                  aria-label="Choose photos to attach"
                >
                  <Paperclip aria-hidden />
                  Choose files
                </Button>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={docsLocked}
                  onChange={(e) => {
                    void onPick(e.target.files);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </div>
            </KanbanBoard>
            {displayError ? (
              <p
                className="px-1 text-xs italic text-red-600 dark:text-red-400"
                role="alert"
              >
                {displayError}
              </p>
            ) : null}
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}
