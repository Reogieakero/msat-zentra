"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REASON_LABELS,
  resolveFlag,
  type GradeFlagRow,
} from "./grade-flags-data";
import styles from "./ResolveFlagDialog.module.css";

interface ResolveFlagDialogProps {
  flag: GradeFlagRow | null;
  onClose: () => void;
  onResolved: () => void;
}

export function ResolveFlagDialog({ flag, onClose, onResolved }: ResolveFlagDialogProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setNote("");
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!flag) return;
    if (!note.trim()) {
      setError("A resolution note is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resolveFlag(flag.id, note.trim());
      close();
      onResolved();
    } catch {
      setError("Could not resolve the flag. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={flag !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className={styles.dialog}>
        {flag ? (
          <>
            <DialogHeader>
              <DialogTitle>Resolve flag</DialogTitle>
              <DialogDescription>
                {REASON_LABELS[flag.reason]} · {flag.student.name} · {flag.subject.name} ·{" "}
                {flag.section.name}
              </DialogDescription>
            </DialogHeader>

            <div className={styles.fields}>
              {flag.note ? <p className={styles.note}>&ldquo;{flag.note}&rdquo;</p> : null}
              <div className={styles.field}>
                <Label htmlFor="resolve-note">Resolution note</Label>
                <Textarea
                  id="resolve-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What was corrected?"
                  rows={3}
                  maxLength={2000}
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Resolving…" : "Resolve flag"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
