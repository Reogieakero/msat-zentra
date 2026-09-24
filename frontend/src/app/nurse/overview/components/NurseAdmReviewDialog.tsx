"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  AdmReviewDialog as SharedAdmReviewDialog,
  type AdmReviewDraft,
} from "@/components/adm-review/AdmReviewDialog";
import {
  reviewNurseAdmCase,
  scheduleClinicSession,
  type NurseQueueRow,
} from "./nurse-overview-data";
import { useNurseMutation } from "./use-nurse-mutation";

/**
 * ADM consultation review for cases the adviser routed to the nurse —
 * shared review UI, nurse wiring: review here, then Create referral opens
 * the fill-up form sheet in place (no navigation) via onCreateReferral.
 * Reject (turn down) closes the case straight from this dialog.
 * "Start handling" stays clinic-only — this dialog is the nurse's
 * pipeline path for ADM cases.
 *
 * Book-session and reject run through useNurseMutation so the buttons get
 * action-specific pending state, success toasts fire only after the backend
 * confirms, and errors reset loading + surface inline (shared dialog) without
 * duplicate toasts.
 */
export function NurseAdmReviewDialog({
  row,
  onChanged,
  onCreateReferral,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
  onCreateReferral: (draft: { recommendation: string; scheduledAt?: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const bookMutation = useNurseMutation({
    mutationFn: (scheduledAt: string) =>
      scheduleClinicSession(row.id, { scheduledAt }),
    successTitle: "Session booked",
    successDescription: () =>
      `${row.student}'s case stays pending until you confirm the referral.`,
    errorFallback: "Could not book the session. Try again.",
    silentError: true,
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
    onSuccessExtra: () => onChanged(),
  });

  async function bookSessionOnly(scheduledAt: string) {
    await bookMutation.mutateAsync(scheduledAt);
  }

  async function decideReject(recommendation: string) {
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
      <Button
        variant="outline"
        size="xs"
        style={{ height: "32px" }}
        onClick={() => setOpen(true)}
        disabled={busy}
      >
        Review ADM case
      </Button>

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
        referred={
          row.waitingDays !== null && row.waitingDays > 0
            ? `${row.date} · waiting ${row.waitingDays}d`
            : row.date
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