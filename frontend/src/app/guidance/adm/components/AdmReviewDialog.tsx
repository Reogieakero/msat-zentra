"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  AdmReviewDialog as SharedAdmReviewDialog,
  type AdmReviewDraft,
} from "@/components/adm-review/AdmReviewDialog";
import {
  bookAdmConsultationSession,
  listAdmConsultationSessions,
  reviewAdmConsultation,
} from "./guidance-adm-data";
import { dismissReferral } from "../../referrals/components/guidance-referrals-data";

/* Case identity for the intake summary (Name / LRN / Section / Observed /
   Referred) — passed by both callers from their row data. */
export interface AdmReviewCaseInfo {
  lrn?: string;
  section?: string;
  grade?: string;
  observed?: string;
  category?: string;
  date?: string;
}

/**
 * ADM consultation review for cases the adviser routed to guidance —
 * shared review UI, guidance wiring. Create referral hands the typed
 * recommendation to the caller, which opens the fill-up form sheet in
 * place (no navigation).
 */
export function AdmReviewDialog({
  referralId,
  student,
  anecdotalId,
  info,
  open,
  onClose,
  onChanged,
  onCreateReferral,
  // "queue" = ADM consultation queue (/guidance/adm): reject goes through
  // the consultation review. "desk" = ADM-type row on /guidance/referrals
  // (already ADM-flagged on the guidance desk): reject dismisses the case
  // directly instead.
  mode = "queue",
}: {
  referralId: string;
  student: string;
  anecdotalId: string | null;
  info?: AdmReviewCaseInfo;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onCreateReferral: (draft: AdmReviewDraft) => void;
  mode?: "queue" | "desk";
}) {
  const queryClient = useQueryClient();
  // Sessions already booked on the case — fetched silently, only to guard
  // the one-active-session rule (they render on the page list).
  const [bookedScheduled, setBookedScheduled] = React.useState(false);

  // Reset the guard every time the dialog opens (or retargets a new case),
  // synced during render — never in an effect. The session-list fetch below
  // stays in an effect: only async work lives there.
  const openKey = open ? referralId : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setBookedScheduled(false);
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listAdmConsultationSessions(referralId);
        if (!cancelled) setBookedScheduled(rows.some((s) => s.status === "scheduled"));
      } catch {
        if (!cancelled) setBookedScheduled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, referralId]);

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
    void queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
    void queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
    onChanged();
  }

  async function bookSessionOnly(scheduledAt: string) {
    try {
      await bookAdmConsultationSession(referralId, { scheduledAt });
    } catch {
      toast.error({
        title: "Could not book the session",
        description: "The session was not saved. Check your connection and try again.",
      });
      throw new Error("book-failed");
    }
    toast.success({
      title: "Session booked",
      description: `${student}'s case stays pending until you decide.`,
    });
    try {
      const rows = await listAdmConsultationSessions(referralId);
      setBookedScheduled(rows.some((s) => s.status === "scheduled"));
    } catch {
      setBookedScheduled(false);
    }
    refreshAll();
  }

  async function decideReject(recommendation: string) {
    try {
      if (mode === "desk") {
        // Desk rows are already ADM-flagged — rejecting closes the case
        // directly (same outcome, no consultation endpoint involved).
        await dismissReferral(referralId, recommendation);
      } else {
        await reviewAdmConsultation(referralId, { recommendation, outcome: "reject" });
      }
    } catch {
      toast.error({
        title: "Could not reject the case",
        description: "The rejection did not go through. Check your connection and try again.",
      });
      throw new Error("reject-failed");
    }
    toast.success({
      title: "Rejected from ADM",
      description: `${student}'s case was closed with your recommendation kept on record.`,
    });
    refreshAll();
  }

  function goToReferralForm(draft: AdmReviewDraft) {
    toast.success({
      title: "Referral form opened",
      description: "Confirm the form to endorse the case to the ADM coordinator.",
    });
    onCreateReferral(draft);
  }

  const lrn = info?.lrn?.trim() || "—";
  const sectionLine = [info?.section, info?.grade].filter(Boolean).join(" · ") || "—";
  const observed = info?.observed?.trim() || info?.date?.trim() || "—";
  const category = info?.category?.trim() || "—";
  const referred = info?.date?.trim() || "—";

  return (
    <SharedAdmReviewDialog
      open={open}
      onClose={onClose}
      student={student}
      lrn={lrn}
      sectionLine={sectionLine}
      observed={observed}
      category={category}
      referred={referred}
      anecdotalId={anecdotalId}
      description={
        mode === "queue" ? (
          <>Review {student}&rsquo;s case, write your recommendation, then create the referral — confirming endorses the case to the ADM coordinator at once. Or reject it.</>
        ) : (
          <>Review {student}&rsquo;s case, write your recommendation, then create the referral — or book a session without deciding, or reject it.</>
        )
      }
      sessionSectionLabel="Counseling session (optional)"
      sessionFieldHint="Book it now without deciding, or carry on with the review."
      recommendationPlaceholder="What did your review find? What should happen next…"
      sessionNoun="counseling"
      hasActiveSession={bookedScheduled}
      copy={{
        recommendationRequired: "Write your recommendation first — the record needs it.",
        rejectFailed: "Could not reject this case. Try again.",
      }}
      onBookSession={bookSessionOnly}
      onReject={decideReject}
      onCreateReferral={goToReferralForm}
    />
  );
}
