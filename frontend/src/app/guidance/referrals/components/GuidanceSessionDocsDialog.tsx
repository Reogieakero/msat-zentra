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
import { toast } from "@/components/ui/sonner";
import {
  apiErrorMessage,
  deleteSessionAttachment,
  sessionAttachmentError,
  uploadSessionAttachments,
  type CounselingSessionAttachment,
  type CounselingSessionItem,
} from "./guidance-referrals-data";
import styles from "./GuidanceReferralDialogs.module.css";

/* Live clock for the docs lock — ticks every second while open so the
   unlock flips exactly when the session time arrives. */
function useNowTick(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Optional documentation on one counseling session: view filed photos,
 * attach more, or remove a wrong upload. Same logic as the nurse booked
 * sessions — filing unlocks once the session time arrives (viewing stays
 * allowed), and docs never gate Done. Available on open cases from the
 * session list ("Docs" button).
 */
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
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const now = useNowTick(open);

  if (!open) return null;

  // Documentation unlocks once the session time arrives — viewing stays
  // allowed, but new uploads wait for an ongoing/completed session.
  const docsLocked =
    session.status === "scheduled" &&
    new Date(session.scheduledAt).getTime() > now;

  async function onPick(list: FileList | null) {
    if (!list) return;
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
    setUploading(true);
    try {
      const added = await uploadSessionAttachments(referralId, session.id, picked);
      setDocs((prev) => [...prev, ...added]);
      toast.success({
        title: "Photos filed",
        description: `${added.length} photo${added.length === 1 ? "" : "s"} attached to this session.`,
      });
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not upload the photos. Try again."));
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await deleteSessionAttachment(referralId, session.id, id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove that photo. Try again."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) { onClose(); setError(null); } }}>
      <DialogContent>
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
        {error ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error}</p></div>) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
