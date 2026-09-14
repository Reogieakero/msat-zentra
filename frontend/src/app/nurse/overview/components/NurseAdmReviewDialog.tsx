"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "@/components/ui/sonner";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { ClinicDatePicker, ClinicTimePicker } from "./ClinicDateTimePicker";
import {
  apiErrorMessage,
  reviewNurseAdmCase,
  saveNurseReferralDraft,
  type NurseQueueRow,
} from "./nurse-overview-data";
import styles from "./nurse-overview.module.css";

/**
 * ADM consultation review for cases the adviser routed to the nurse.
 * Mirrors the guidance flow: review here, then Create referral opens the
 * dedicated referral form page (/nurse/adm/referral/[referralId]) where the
 * nurse fills up the form and confirms forwarding to the ADM coordinator.
 * Reject (turn down) closes the case straight from this dialog.
 * "Start handling" stays clinic-only — this dialog is the nurse's pipeline
 * path for ADM cases.
 */
export function NurseAdmReviewDialog({
  row,
  onChanged,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function openDialog() {
    setRecommendation("");
    setSessionDate("");
    setSessionTime("");
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  // Create-referral gate: recommendation is mandatory; an optional session
  // must be fully specified and in the future. Both travel to the dedicated
  // form page, which confirms the forward.
  function goToReferralForm() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    let scheduledAt: string | undefined;
    if (sessionDate || sessionTime) {
      if (!sessionDate || !sessionTime) {
        setError("Pick both a date and a time for the clinic session — or leave both empty to forward without one.");
        return;
      }
      const at = new Date(`${sessionDate}T${sessionTime}:00`);
      if (Number.isNaN(at.getTime())) {
        setError("Pick a valid date and time for the clinic session.");
        return;
      }
      if (at.getTime() <= Date.now()) {
        setError("Clinic session must be set in the future.");
        return;
      }
      scheduledAt = `${sessionDate}T${sessionTime}:00`;
    }
    setError(null);
    saveNurseReferralDraft({ recommendation: recommendation.trim(), scheduledAt });
    setOpen(false);
    router.push(`/nurse/adm/referral/${encodeURIComponent(row.id)}`);
  }

  async function decideReject() {
    if (!recommendation.trim()) {
      setError("Write your recommendation first — the coordinator needs it.");
      return;
    }
    setError(null);
    setActing(true);
    try {
      await reviewNurseAdmCase(row.id, { recommendation: recommendation.trim(), outcome: "reject" });
      toast.success({
        title: "Case turned down",
        description: `${row.student}'s case was closed without ADM follow-through.`,
      });
      closeDialog();
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit your review. Try again."));
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="xs" onClick={openDialog}>
        Review ADM case
      </Button>

      {open && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDialog();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review ADM case</DialogTitle>
              <DialogDescription>
                Review {row.student}&rsquo;s case, write your recommendation, then create the
                referral form — forwarding it to the ADM coordinator happens from the
                alerts page once the form is saved. Or turn it down.
              </DialogDescription>
            </DialogHeader>
            <dl className={styles.intakeSummary}>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Name</dt>
                <dd className={styles.intakeValue}>{row.student}</dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>LRN</dt>
                <dd className={styles.intakeValue}>{row.lrn}</dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Section</dt>
                <dd className={styles.intakeValue}>
                  {row.section} · {row.grade}
                </dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Observed</dt>
                <dd className={styles.intakeValue}>
                  {row.anecdotal?.observedAt ?? "—"} · {row.anecdotal?.category ?? row.category}
                </dd>
              </div>
              <div className={styles.intakeRow}>
                <dt className={styles.intakeLabel}>Referred</dt>
                <dd className={styles.intakeValue}>
                  {row.date}
                  {row.waitingDays !== null && row.waitingDays > 0 ? ` · waiting ${row.waitingDays}d` : ""}
                </dd>
              </div>
            </dl>
            <div className={styles.dialogField}>
              <Label>Official report</Label>
              {row.anecdotalId ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setPreviewId(row.anecdotalId)}
                    aria-label={`Open the official anecdotal report for ${row.student}`}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <FolderCard
                      label={row.student}
                      sublabel={`${row.lrn} · ${row.anecdotal?.observedAt ?? row.date}`}
                      files={[
                        {
                          name: `OCForm-01_${row.anecdotal?.observedAt ?? row.date}`,
                          tag: `${row.anecdotal?.category ?? row.category} · tap to preview`,
                          icon: "doc" as const,
                        },
                      ]}
                    />
                  </button>
                </div>
              ) : (
                <p className={styles.dialogHint}>No official report attached to this case.</p>
              )}
            </div>
            <div className={styles.dialogField}>
              <span className={styles.dialogLabel}>Clinic session (optional)</span>
              <div className={styles.sessionGrid}>
                <ClinicDatePicker
                  id={`adm-session-date-${row.id}`}
                  label="Date"
                  value={sessionDate}
                  onChange={setSessionDate}
                  min={todayKey()}
                />
                <ClinicTimePicker
                  id={`adm-session-time-${row.id}`}
                  label="Time"
                  value={sessionTime}
                  onChange={setSessionTime}
                />
              </div>
              <p className={styles.dialogHint}>Held at the school clinic. Leave both empty to forward without booking.</p>
            </div>
            <div className={styles.dialogField}>
              <Label htmlFor={`adm-rec-${row.id}`}>Your recommendation (required)</Label>
              <Textarea
                id={`adm-rec-${row.id}`}
                className={styles.dialogTextarea}
                placeholder="Should this student enter ADM? Why…"
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                maxLength={500}
              />
            </div>
            {error ? <p className={styles.dialogError}>{error}</p> : null}
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void decideReject()} disabled={acting}>
                {acting ? "Sending…" : "Turn down"}
              </Button>
              <Button onClick={goToReferralForm} disabled={acting}>
                Create referral…
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {previewId && (
        <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}
