"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteSessionAttachment,
  sessionAttachmentError,
  uploadSessionAttachments,
} from "@/services/guidance/sessions.service";
import type {
  CounselingSessionAttachment,
  CounselingSessionItem,
} from "@/services/guidance/guidance.types";
import { useGuidanceMutation } from "../../overview/components/use-guidance-mutation";
import styles from "./GuidanceReferralDialogs.module.css";

import { useActiveNowTick } from "@/lib/clock";

export function SessionDocsDialog({
  referralId,
  session,
  open,
  onClose,
  onChanged,
}: {
  referralId: string;
  session: CounselingSessionItem;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [docs, setDocs] = React.useState<CounselingSessionAttachment[]>(session.attachments ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const now = useActiveNowTick(open);
  const uploadMutation = useGuidanceMutation({
    mutationFn: (picked: File[]) =>
      uploadSessionAttachments(referralId, session.id, picked),
    sourceId: referralId,
    successTitle: "Photos filed",
    successDescription: (_vars, added) =>
      `${added.length} photo${added.length === 1 ? "" : "s"} attached to this session.`,
    errorFallback: "Could not upload the photos. Try again.",
    silentError: true,
    onSuccessExtra: (added) => {
      setDocs((prev) => [...prev, ...added]);
      setError(null);
      onChanged();
    },
  });
  const removeMutation = useGuidanceMutation({
    mutationFn: (id: string) => deleteSessionAttachment(referralId, session.id, id),
    sourceId: referralId,
    successTitle: "Photo removed",
    successDescription: () => "The photo was removed from this session.",
    errorFallback: "Could not remove that photo. Try again.",
    silentError: true,
    onSuccessExtra: (_data, id) => {
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setError(null);
      onChanged();
    },
  });
  const uploading = uploadMutation.isPending;
  const removingId = removeMutation.isPending
    ? ((removeMutation.variables as string | undefined) ?? null)
    : null;
  const mutationError = uploadMutation.error ?? removeMutation.error;
  const displayError = error ?? (mutationError ? mutationError.message : null);

  if (!open) return null;

  const docsLocked =
    session.status === "scheduled" &&
    new Date(session.scheduledAt).getTime() > now;

  function onPick(list: FileList | null) {
    if (!list || uploading) return;
    if (docsLocked) {
      setError("This session hasn't started yet — you can file documentation once the scheduled time arrives.");
      return;
    }
    const picked = Array.from(list).slice(0, 5);
    const problem = sessionAttachmentError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    uploadMutation.mutate(picked);
  }

  function onRemove(id: string) {
    if (removeMutation.isPending) return;
    setError(null);
    removeMutation.mutate(id);
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !uploading && !removeMutation.isPending) { onClose(); setError(null); } }}>
      <DialogContent aria-busy={(uploading || removeMutation.isPending) || undefined}>
        <DialogHeader>
          <DialogTitle>Session documentation</DialogTitle>
          <DialogDescription>
            Optional photos for this session — JPG/PNG/WEBP, 5 MB each.
          </DialogDescription>
        </DialogHeader>
        {docsLocked ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              This session hasn&apos;t started yet — filing unlocks once the scheduled time arrives. Filed photos below stay viewable.
            </p>
          </div>
        ) : null}
        {docs.length === 0 ? (
          <p style={{ fontSize: "0.875rem", opacity: 0.75 }}>No photos filed yet.</p>
        ) : (
          <ul style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))", listStyle: "none", padding: 0, margin: 0 }}>
            {docs.map((d) => (
              <li key={d.id} style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: "0.5rem", overflow: "hidden" }}>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${d.fileName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.fileUrl} alt={d.fileName} style={{ width: "100%", height: "5.5rem", objectFit: "cover", display: "block" }} />
                </a>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem", padding: "0.25rem 0.375rem" }}>
                  <span style={{ fontSize: "0.6875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.fileName}>
                    {d.fileName}
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={removingId === d.id}
                    onClick={() => void onRemove(d.id)}
                    aria-label={`Remove ${d.fileName}`}
                  >
                    {removingId === d.id ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <Label htmlFor={`guidance-docs-${session.id}`}>Attach photos (optional)</Label>
            <Input
              id={`guidance-docs-${session.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || docsLocked}
              onChange={(e) => void onPick(e.target.files)}
            />
          </div>
        </div>
        {uploading ? (
            <p
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", opacity: 0.9 }}
              role="status"
              aria-live="polite"
            >
              <Loader2 className="animate-spin" aria-hidden />
              Uploading photos…
            </p>
          ) : null}
          {displayError ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{displayError}</p></div>) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={uploading || removeMutation.isPending}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
