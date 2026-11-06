"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  AdmReviewDialog as SharedAdmReviewDialog,
  type AdmReviewDraft,
} from "@/components/adm-review/AdmReviewDialog";
import { reviewNurseAdmCase } from "@/services/nurse/referrals.service";
import { scheduleClinicSession } from "@/services/nurse/sessions.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { useNurseMutation } from "./use-nurse-mutation";

export function NurseAdmReviewDialog({
  row,
  onChanged,
  onCreateReferral,
  open: controlledOpen,
  onClose: controlledOnClose,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
  onCreateReferral: (draft: { recommendation: string; scheduledAt?: string }) => void;
  /** Controlled visibility — pass together with `onClose` when the parent
      owns the trigger (e.g. a row's kebab menu). The built-in trigger button
      only renders in uncontrolled mode. */
  open?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(next: boolean) {
    if (isControlled) {
      if (!next) controlledOnClose?.();
      return;
    }
    setInternalOpen(next);
  }

  const bookMutation = useNurseMutation({
    mutationFn: (scheduledAt: string) =>
      scheduleClinicSession(row.id, { scheduledAt }),
    successTitle: "Session booked",
    successDescription: () =>
      `${row.student}'s case stays pending until you confirm the referral.`,
    errorFallback: "Could not book the session. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => onChanged(),
  });

  const rejectMutation = useNurseMutation({
    mutationFn: (recommendation: string) =>
      reviewNurseAdmCase(row.id, { recommendation, outcome: "reject" }),
    successTitle: "Case rejected",
    successDescription: () =>
      `${row.student}'s case was closed without ADM follow-through.`,
    errorFallback: "Could not submit your review. Try again.",
    silentError: true,
    sourceId: row.id,
    onSuccessExtra: () => onChanged(),
  });

  async function bookSessionOnly(scheduledAt: string) {
    // Close at once — the shared Dock reports the booking until it settles.
    setOpen(false);
    await bookMutation.mutateAsync(scheduledAt);
  }

  async function decideReject(recommendation: string) {
    setOpen(false);
    await rejectMutation.mutateAsync(recommendation);
  }

  function goToReferralForm(draft: AdmReviewDraft) {
    setOpen(false);
    toast.info({
      title: "Referral form opened",
      description: "Confirm the form to endorse the case to the ADM coordinator.",
    });
    onCreateReferral(draft);
  }

  const busy = bookMutation.isPending || rejectMutation.isPending;

  return (
    <>
      {!isControlled && (
        <Button
          variant="outline"
          size="xs"
          style={{ height: "32px" }}
          onClick={() => setOpen(true)}
          disabled={busy}
        >
          Review ADM case
        </Button>
      )}

      <SharedAdmReviewDialog
        open={open}
        onClose={() => {
          setOpen(false);
          bookMutation.reset();
          rejectMutation.reset();
        }}
        student={row.student}
        lrn={row.lrn}
        sectionLine={`${row.section} · ${row.grade}`}
        observed={row.anecdotal?.observedAt ?? "—"}
        category={row.anecdotal?.category ?? row.category}
        referred={row.date}
        waiting={
          row.waitingDays !== null && row.waitingDays > 0
            ? `waiting ${row.waitingDays}d`
            : undefined
        }
        anecdotalId={row.anecdotalId}
        description={
          <>Review {row.student}&rsquo;s case, write your recommendation, then create the referral form — confirming it endorses the case to the ADM coordinator at once. Or reject it.</>
        }
        sessionSectionLabel="Clinic session (optional)"
        sessionFieldHint="Held at the school clinic. Book it now without deciding, or carry it into the referral form."
        recommendationPlaceholder="Should this student enter ADM? Why…"
        sessionNoun="clinic"
        createConfirmHint="Confirming there endorses the case to the ADM coordinator at once."
        hasActiveSession={row.sessions.some((s) => s.status === "scheduled")}
        copy={{
          askBookEmpty:
            "Pick a date and a time first — or leave both empty and carry the session into the referral form instead.",
          pastSession: "Clinic session must be set in the future.",
          bookFailed: "Could not book the session. Try again.",
          rejectFailed: "Could not submit your review. Try again.",
        }}
        onBookSession={bookSessionOnly}
        onReject={decideReject}
        onCreateReferral={goToReferralForm}
      />
    </>
  );
}
