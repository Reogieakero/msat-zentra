"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REASON_LABELS,
  resolveFlag,
  type GradeFlagRow,
} from "./grade-flags-data";
import { sileo } from "@/components/ui/sonner";
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
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await resolveFlag(flag.id, note.trim());
      close();
      onResolved();
      sileo.success({ title: "Flag resolved", description: "The resolution was recorded." });
    } catch {
      setError("Could not resolve the flag. Try again.");
      sileo.error({ title: "Could not resolve flag", description: "Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CardModal
      open={flag !== null}
      onClose={() => {
        // Locked while resolving — closes only on server confirmation.
        if (submitting) return;
        close();
      }}
      dismissable={!submitting}
      size="md"
      title="Resolve flag"
      description={
        flag ? (
          <>
            {REASON_LABELS[flag.reason]} · {flag.student.name} · {flag.subject.name} ·{" "}
            {flag.section.name}
          </>
        ) : undefined
      }
      watchKey={flag?.id}
    >
      {flag ? (
        <>
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={close}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting} aria-busy={submitting || undefined}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Resolving…
                </>
              ) : (
                "Resolve flag"
              )}
            </Button>
          </div>
        </>
      ) : null}
    </CardModal>
  );
}
