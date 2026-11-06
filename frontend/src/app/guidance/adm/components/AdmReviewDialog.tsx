"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/guidanceChannel";
import {
  AdmReviewDialog as SharedAdmReviewDialog,
  type AdmReviewDraft,
} from "@/components/adm-review/AdmReviewDialog";
import {
  bookAdmConsultationSession,
  listAdmConsultationSessions,
  reviewAdmConsultation,
} from "@/services/guidance/adm.service";
import { dismissReferral } from "@/services/guidance/referrals.service";
import { useGuidanceInvalidate } from "../../overview/components/use-guidance-mutation";

export interface AdmReviewCaseInfo {
  lrn?: string;
  section?: string;
  grade?: string;
  observed?: string;
  category?: string;
  date?: string;
}

export function AdmReviewDialog({
  referralId,
  student,
  anecdotalId,
  info,
  open,
  onClose,
  onChanged,
  onCreateReferral,

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
  const invalidateGuidance = useGuidanceInvalidate();
  const dock = useDock();

  const [bookedScheduled, setBookedScheduled] = React.useState(false);

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

    markSelfNotified(referralId);
    invalidateGuidance();
    onChanged();
  }

  async function bookSessionOnly(scheduledAt: string) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "adm-book",
        title: "Booking ADM consultation",
        description: `${student} · ${new Date(scheduledAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`,
      });
    } catch {
      taskId = null;
    }
    try {
      await bookAdmConsultationSession(referralId, { scheduledAt });
    } catch {
      if (taskId) dock.failTask(taskId, "Could not book the session.");
      toast.error({
        title: "Could not book the session",
        description: "The session was not saved. Check your connection and try again.",
      });
      throw new Error("book-failed");
    }
    if (taskId) dock.completeTask(taskId, "Session booked — the case stays pending until you decide.");
    try {
      const rows = await listAdmConsultationSessions(referralId);
      setBookedScheduled(rows.some((s) => s.status === "scheduled"));
    } catch {
      setBookedScheduled(false);
    }
    refreshAll();
  }

  async function decideReject(recommendation: string) {
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Rejecting from ADM",
        description: `${student}'s case`,
      });
    } catch {
      taskId = null;
    }
    try {
      if (mode === "desk") {

        await dismissReferral(referralId, recommendation);
      } else {
        await reviewAdmConsultation(referralId, { recommendation, outcome: "reject" });
      }
    } catch {
      if (taskId) dock.failTask(taskId, "Could not reject the case.");
      toast.error({
        title: "Could not reject the case",
        description: "The rejection did not go through. Check your connection and try again.",
      });
      throw new Error("reject-failed");
    }
    if (taskId) dock.completeTask(taskId, "Case rejected — the recommendation is kept on record.");
    refreshAll();
  }

  function goToReferralForm(draft: AdmReviewDraft) {

    toast.info({
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
