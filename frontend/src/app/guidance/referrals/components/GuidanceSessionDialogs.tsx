"use client";

import { BookSessionDialog } from "@/components/session-booking/BookSessionDialog";
import { fetchDaySchedule } from "@/services/guidance/sessions.service";
import { FinishSessionDialog as SharedFinishSessionDialog } from "@/components/session-booking/FinishSessionDialog";
import { CancelSessionDialog as SharedCancelSessionDialog } from "@/components/session-booking/CancelSessionDialog";
import { DeleteSessionDialog as SharedDeleteSessionDialog } from "@/components/session-booking/DeleteSessionDialog";
import type {
  CounselingSessionItem,
  CounselingSessionType,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import {
  SESSION_KIND_OPTIONS,
  formatActionTime,
  formatDateTime,
  sessionTypeLabel,
  toDateInputValue,
  toTimeInputValue,
} from "./guidance-referrals-format";
import type {
  GuidanceActionDialogs,
  GuidanceDialogKey,
} from "./GuidanceReferralDialogs";

export function GuidanceSessionDialogs({
  dialogs,
  activeRow,
  activeSession,
  isActionPending,
  closeDialog,
  handleAction,
}: {
  dialogs: GuidanceActionDialogs;
  activeRow: GuidanceReferralItem | null;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  closeDialog: (dialog: GuidanceDialogKey) => void;
  handleAction: (action: string, payload: unknown) => void;
}) {
  return (
    <>

      {dialogs.schedule && (
        <BookSessionDialog
          open
          onClose={() => closeDialog("schedule")}
          onSubmit={(fields) =>
            handleAction("schedule", {
              scheduledAt: fields.scheduledAt,
              sessionType: fields.sessionType as CounselingSessionType,
              ...(fields.venue ? { venue: fields.venue } : {}),
            })
          }
          description="Schedule a counseling session"
          studentCard={
            activeRow
              ? {
                  name: activeRow.student,
                  sub: [activeRow.grade, activeRow.section].filter(Boolean).join(" · "),
                }
              : null
          }
          fetchTakenTimes={(dateKey, signal) => fetchDaySchedule(dateKey, { signal })}
          venueHint="Held at the guidance office unless another venue is given."
          venuePlaceholder="Guidance office"
          showSessionType
          sessionTypeOptions={SESSION_KIND_OPTIONS}
          hasActiveSession={
            !!activeRow?.sessions.some((s) => s.status === "scheduled")
          }
          busy={isActionPending}
          idPrefix="ref-sess"
        />
      )}

      {dialogs.finish && (
        <SharedFinishSessionDialog
          open
          onClose={() => closeDialog("finish")}
          onSubmit={(fields) => {
            if (!activeSession?.id) return;
            handleAction("finish", {
              sessionId: activeSession.id,
              sessionNotes: fields.sessionNotes,
              ...(fields.outcome ? { outcome: fields.outcome } : {}),
              ...(fields.followUpSession
                ? {
                    followUpSession: {
                      scheduledAt: fields.followUpSession.scheduledAt,
                      sessionType:
                        fields.followUpSession.sessionType as CounselingSessionType,
                      ...(fields.followUpSession.venue
                        ? { venue: fields.followUpSession.venue }
                        : {}),
                    },
                  }
                : {}),
            });
          }}
          description={
            activeSession
              ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)}${activeSession.venue ? ` · ${activeSession.venue}` : ""}`
              : "Record what happened in this session."
          }
          followUpTitle="Book a follow-up session (optional)"
          followUpHint="If this needs another talk, book it now so it stays on the plan."
          followUpDateLabel="Follow-up date"
          followUpTimeLabel="Follow-up time"
          venuePlaceholder="e.g. Guidance office"
          showSessionType
          sessionTypeOptions={SESSION_KIND_OPTIONS}
          busy={isActionPending}
          idPrefix="ref-done"
        />
      )}

      {dialogs.move && (
        <BookSessionDialog
          open
          onClose={() => closeDialog("move")}
          onSubmit={(fields) => {
            if (!activeSession?.id) return;
            handleAction("move", {
              sessionId: activeSession.id,
              scheduledAt: fields.scheduledAt,
            });
          }}
          description={
            activeSession
              ? `Currently ${formatActionTime(activeSession.scheduledAt)}. Pick the new date and time.`
              : "Pick the new date and time."
          }
          fetchTakenTimes={(dateKey, signal) => fetchDaySchedule(dateKey, { signal })}
          venueHint="Held at the guidance office unless another venue is given."
          venuePlaceholder="Guidance office"
          showSessionType
          sessionTypeOptions={SESSION_KIND_OPTIONS}
          hasActiveSession={false}
          busy={isActionPending}
          idPrefix="ref-move"
          title="Move session"
          submitLabel="Move session"
          busyLabel="Moving…"
          initialDate={activeSession ? toDateInputValue(activeSession.scheduledAt) : ""}
          initialTime={activeSession ? toTimeInputValue(activeSession.scheduledAt) : ""}
          initialVenue={activeSession?.venue ?? ""}
          initialSessionType={activeSession?.sessionType}
        />
      )}

      {dialogs.cancelSess && (
        <SharedCancelSessionDialog
          open
          onClose={() => closeDialog("cancelSess")}
          onSubmit={(reason) => {
            if (!activeSession?.id) return;
            handleAction("cancelSess", {
              sessionId: activeSession.id,
              ...(reason ? { cancelReason: reason } : {}),
            });
          }}
          description={
            activeSession
              ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)} will be cancelled.`
              : "This session will be cancelled."
          }
          keepLabel="Keep session"
          busy={isActionPending}
          idPrefix="ref-cancel"
        />
      )}

      {dialogs.deleteSess && (
        <SharedDeleteSessionDialog
          open
          onClose={() => closeDialog("deleteSess")}
          onConfirm={() => {
            if (!activeSession?.id) return;
            handleAction("deleteSess", { sessionId: activeSession.id });
          }}
          busy={isActionPending}
        />
      )}
    </>
  );
}
