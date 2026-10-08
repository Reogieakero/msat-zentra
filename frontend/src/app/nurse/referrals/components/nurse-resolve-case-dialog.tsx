"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/errors";
import { updateNurseReferralStatus } from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "../../overview/components/use-nurse-mutation";
import type { DialogProps } from "./NurseSessionDialogs";
import styles from "./NurseReferralDialogs.module.css";
export function ResolveCaseDialog({
  row,
  open,
  onClose,
  onChanged,
}: DialogProps & { row: NurseQueueRow }) {
  const [summary, setSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const resolveMutation = useNurseMutation({
    mutationFn: (resolutionSummary?: string) =>
      updateNurseReferralStatus(row.id, "resolved", resolutionSummary),
    successTitle: "Case closed",
    successDescription: () => `${row.student}'s case is resolved.`,
    errorFallback: "Could not resolve this case. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => {
      onClose();
      setSummary("");
      setError(null);
      onChanged();
    },
  });
  const acting = resolveMutation.isPending;
  const serverError = resolveMutation.error
    ? apiErrorMessage(resolveMutation.error, "Could not resolve this case. Try again.")
    : null;
  if (!open) return null;
  const completed = row.sessions.filter((s) => s.status === "completed").length;
  const docCount = row.sessions.reduce((n, s) => n + (s.attachments?.length ?? 0), 0);
  const canResolve = completed > 0;
  function save() {
    if (!canResolve) {
      setError("Finish at least one clinic session before marking this case done — schedule one, mark it done, then come back.");
      return;
    }
    setError(null);
    resolveMutation.mutate(summary.trim() ? summary.trim() : undefined);
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !acting) { onClose(); setError(null); resolveMutation.reset(); } }}>
      <DialogContent className={styles.dialogScrollHidden} aria-busy={acting || undefined}>
        <DialogHeader>
          <DialogTitle>Finish &amp; close</DialogTitle>
          <DialogDescription>
            Step 4 — close {row.student}&rsquo;s case. A closing summary is optional but recommended.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <div className={styles.formFull}>
            <div className={styles.errorBlock} style={{ borderStyle: "solid" }} aria-live="polite">
              <p className={styles.errorText} style={{ fontWeight: 600 }}>
                {canResolve
                  ? `Ready to close — ${completed} session${completed === 1 ? "" : "s"} done${docCount > 0 ? ` · ${docCount} photo${docCount === 1 ? "" : "s"} filed` : " · no photos filed (optional)"}.`
                  : "Not ready yet — finish at least one clinic session first. Photos are optional."}
              </p>
            </div>
          </div>
          <div className={styles.formFull}>
            <Label htmlFor={`nurse-resolve-${row.id}`}>Closing summary (optional)</Label>
            <Textarea
              id={`nurse-resolve-${row.id}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What was done? What was the outcome…"
            />
          </div>
        </div>
        {error || serverError ? (<div className={styles.errorBlock} role="alert"><p className={styles.errorText}>{error ?? serverError}</p></div>) : null}
        <DialogFooter>
          <Button variant="destructive" className={styles.btnRed} onClick={onClose} disabled={acting}>
            Cancel
          </Button>
          <Button onClick={() => save()} disabled={acting || !canResolve} aria-busy={acting || undefined}>
            {acting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {acting ? "Closing…" : "Finish & close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
