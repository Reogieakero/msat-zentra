"use client";
import * as React from "react";
import { useDock } from "@/components/dock/dock-store";
import type { AdmReviewCopy } from "./AdmReviewDialog";
export function useAdmReviewDraft({
  open,
  student,
  sessionNoun,
  hasActiveSession,
  copy,
  formatError,
  onBookSession,
  onReject,
  onCreateReferral,
  onClose,
}: {
  open: boolean;
  student: string;
  sessionNoun: "clinic" | "counseling";
  hasActiveSession: boolean;
  copy: AdmReviewCopy;
  formatError?: (err: unknown, fallback: string) => string;
  onBookSession: (scheduledAt: string) => Promise<void>;
  onReject: (recommendation: string) => Promise<void>;
  onCreateReferral: (draft: { recommendation: string; scheduledAt?: string }) => void;
  onClose: () => void;
}) {
  const [recommendation, setRecommendation] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [booking, setBooking] = React.useState(false);
  const [confirmFor, setConfirmFor] = React.useState<null | "book" | "reject" | "create">(null);
  const [blockedOpen, setBlockedOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setRecommendation("");
    setSessionDate("");
    setSessionTime("");
    setError(null);
    setConfirmFor(null);
    setBlockedOpen(false);
    setPreviewId(null);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }
  const dock = useDock();
  // Returns the message so the shared Dock can report the same problem.
  function fail(err: unknown, fallback: string): string {
    const message = formatError ? formatError(err, fallback) : fallback;
    setError(message);
    return message;
  }
  function resolveSession(): string | null | undefined {
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setError(copy.incompleteSession);
      return null;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setError(copy.invalidSession);
      return null;
    }
    if (at.getTime() <= Date.now()) {
      setError(copy.pastSession);
      return null;
    }
    return `${sessionDate}T${sessionTime}:00`;
  }
  function askBook() {
    if (!sessionDate || !sessionTime) {
      setError(copy.askBookEmpty);
      return;
    }
    setError(null);
    setConfirmFor("book");
  }
  function askReject() {
    if (!recommendation.trim()) {
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setConfirmFor("reject");
  }
  function askCreate() {
    if (hasActiveSession) {
      setBlockedOpen(true);
      return;
    }
    if (!recommendation.trim()) {
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setConfirmFor("create");
  }
  async function bookSessionOnly() {
    if (booking || acting) return;
    if (hasActiveSession) {
      setConfirmFor(null);
      setError(copy.activeSessionExists);
      return;
    }
    const scheduledAt = resolveSession();
    if (!scheduledAt) {
      setConfirmFor(null);
      return;
    }
    setError(null);
    setBooking(true);
    // Hand the request to the bottom-right Dock and close the confirmation
    // and the review overlay at once — the Dock reports the outcome, so a
    // slow request never leaves the review stuck on "Booking…".
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: `Booking ${sessionNoun} session`,
        description: `${student} · ${sessionDate} ${sessionTime}`,
      });
    } catch {
      taskId = null;
    }
    setSessionDate("");
    setSessionTime("");
    setConfirmFor(null);
    onClose();
    try {
      await onBookSession(scheduledAt);
      if (taskId) dock.completeTask(taskId);
    } catch (err) {
      const message = fail(err, copy.bookFailed);
      if (taskId) dock.failTask(taskId, message);
    } finally {
      setBooking(false);
    }
  }
  async function decideReject() {
    if (acting || booking) return;
    if (!recommendation.trim()) {
      setConfirmFor(null);
      setError(copy.recommendationRequired);
      return;
    }
    setError(null);
    setActing(true);
    // Same as booking: the Dock carries the request, the confirmation and
    // the review overlay close right away.
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Rejecting ADM case",
        description: `${student} · closed without ADM`,
      });
    } catch {
      taskId = null;
    }
    setConfirmFor(null);
    onClose();
    try {
      await onReject(recommendation.trim());
      if (taskId) dock.completeTask(taskId);
    } catch (err) {
      const message = fail(err, copy.rejectFailed);
      if (taskId) dock.failTask(taskId, message);
    } finally {
      setActing(false);
    }
  }
  function goToReferralForm() {
    if (!recommendation.trim()) {
      setConfirmFor(null);
      setError(copy.recommendationRequired);
      return;
    }
    const scheduledAt = resolveSession();
    if (scheduledAt === null) {
      setConfirmFor(null);
      return;
    }
    if (scheduledAt && hasActiveSession) {
      setConfirmFor(null);
      setError(copy.activeSessionExists);
      return;
    }
    setError(null);
    setConfirmFor(null);
    onCreateReferral({
      recommendation: recommendation.trim(),
      ...(scheduledAt ? { scheduledAt } : {}),
    });
    onClose();
  }
  return {
    recommendation,
    setRecommendation,
    sessionDate,
    setSessionDate,
    sessionTime,
    setSessionTime,
    acting,
    booking,
    confirmFor,
    setConfirmFor,
    blockedOpen,
    setBlockedOpen,
    error,
    setError,
    previewId,
    setPreviewId,
    askBook,
    askReject,
    askCreate,
    bookSessionOnly,
    decideReject,
    goToReferralForm,
  };
}
