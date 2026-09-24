"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  AdmReviewDialog as SharedAdmReviewDialog,
  type AdmReviewDraft,
} from "@/components/adm-review/AdmReviewDialog";
import {
  apiErrorMessage,
  reviewNurseAdmCase,
  scheduleClinicSession,
  type NurseQueueRow,
} from "./nurse-overview-data";

/**
 * ADM consultation review for cases the adviser routed to the nurse —
 * shared review UI, nurse wiring: review here, then Create referral opens
 * the fill-up form sheet in place (no navigation) via onCreateReferral.
 * Reject (turn down) closes the case straight from this dialog.
 * "Start handling" stays clinic-only — this dialog is the nurse's
 * pipeline path for ADM cases.
 */
export function NurseAdmReviewDialog({
  row,
  onChanged,
  onCreateReferral,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
  // Create referral hands the typed recommendation + optional session to
  // the caller, which opens the fill-up form sheet in place.
  onCreateReferral: (draft: { recommendation: string; scheduledAt?: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);

  async function bookSessionOnly(scheduledAt: string) {
    await scheduleClinicSession(row.id, { scheduledAt });
    toast.success({
      title: "Session booked",
      description: `${row.student}'s case stays pending until you confirm the referral.`,
    });
    onChanged();
  }

  async function decideReject(recommendation: string) {
    await reviewNurseAdmCase(row.id, { recommendation, outcome: "reject" });
    toast.success({
      title: "Case rejected",
      description: `${row.student}'s case was closed without ADM follow-through.`,
    });
    onChanged();
  }

  function goToReferralForm(draft: AdmReviewDraft) {
    setOpen(false);
    toast.info({
      title: "Referral form opened",
      description: "Confirm the form to endorse the case to the ADM coordinator.",
    });
    onCreateReferral(draft);
  }

  return (
    <>
      <Button variant="outline" size="xs" style={{ height: "32px" }} onClick={() => setOpen(true)}>
        Review ADM case
      </Button>

      <SharedAdmReviewDialog
        open={open}
        onClose={() => setOpen(false)}
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
          rejectFailed: "Could not submit your review. Try again.",
        }}
        formatError={apiErrorMessage}
        onBookSession={bookSessionOnly}
        onReject={decideReject}
        onCreateReferral={goToReferralForm}
      />
    </>
  );
}
