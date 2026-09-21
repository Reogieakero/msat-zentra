"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CounselingSessionItem } from "./guidance-interventions-data";
import {
  deleteInterventionSessionDoc,
  listInterventionSessionDocs,
  sessionDocError,
  uploadInterventionSessionDocs,
  type InterventionSessionDoc,
} from "./guidance-interventions-data";
import { sessionTypeLabel } from "../../referrals/components/guidance-referrals-table";
import styles from "./guidance-interventions.module.css";

function apiMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data;
    if (data?.error?.message) return data.error.message;
  }
  return fallback;
}

/**
 * Session documentary: view filed photos, attach more, or remove a wrong
 * upload. Never gates Done — purely the evidence trail. Filing unlocks once
 * the session time arrives (server enforces this too).
 */
export function InterventionSessionDocsDialog({
  followUpId,
  session,
  open,
  onClose,
  onChanged,
}: {
  followUpId: string;
  session: CounselingSessionItem;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [docs, setDocs] = React.useState<InterventionSessionDoc[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fresh list state every time the dialog opens or retargets — synced
  // during render, never in an effect. The fetch below only reads.
  const docsKey = open ? `${followUpId}:${session.id}` : null;
  const [prevDocsKey, setPrevDocsKey] = React.useState<string | null>(null);
  if (docsKey !== prevDocsKey) {
    setPrevDocsKey(docsKey);
    setDocs([]);
    setLoading(true);
    setError(null);
    setPending([]);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listInterventionSessionDocs(followUpId, session.id)
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(apiMessage(err, "Could not load the documents."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, followUpId, session.id]);

  function handlePick(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, 5);
    const problem = sessionDocError(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending(picked);
  }

  async function handleSave() {
    if (pending.length === 0 || uploading) return;
    setError(null);
    setUploading(true);
    try {
      const added = await uploadInterventionSessionDocs(followUpId, session.id, pending);
      setDocs((prev) => [...prev, ...added]);
      setPending([]);
      onChanged?.();
    } catch (err) {
      setError(apiMessage(err, "Could not attach the photos. Try again."));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(id: string) {
    if (removingId !== null) return;
    setRemovingId(id);
    try {
      await deleteInterventionSessionDoc(followUpId, session.id, id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      onChanged?.();
    } catch (err) {
      setError(apiMessage(err, "Could not remove the photo. Try again."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session documents</DialogTitle>
          <DialogDescription>
            Photos filed on {sessionTypeLabel(session.sessionType)} for this session.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className={styles.empty}>Loading documents…</p>
        ) : docs.length === 0 ? (
          <p className={styles.empty}>No documents filed yet.</p>
        ) : (
          <ul className={styles.docGrid}>
            {docs.map((d) => (
              <li key={d.id} className={styles.docItem}>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${d.fileName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.fileUrl} alt={d.fileName} className={styles.docImg} loading="lazy" />
                </a>
                <p className={styles.docName}>{d.fileName}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={removingId === d.id || uploading}
                  onClick={() => void handleRemove(d.id)}
                  aria-label={`Remove ${d.fileName}`}
                >
                  {removingId === d.id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Trash2 aria-hidden />
                  )}
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Label htmlFor={`iv-docs-${session.id}`}>Attach photos</Label>
          <Input
            id={`iv-docs-${session.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading}
            onChange={(e) => {
              handlePick(e.target.files);
              e.target.value = "";
            }}
          />
          <p className={styles.hint}>JPG/PNG/WEBP, max 5 at a time, 5 MB each.</p>
          {pending.length > 0 && (
            <ul className={styles.pendingList}>
              {pending.map((f) => (
                <li key={`${f.name}-${f.size}`}>{f.name}</li>
              ))}
            </ul>
          )}
          <div className={styles.dialogActions}>
            <Button
              type="button"
              disabled={pending.length === 0 || uploading}
              onClick={() => void handleSave()}
            >
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {uploading ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
        {error ? (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
