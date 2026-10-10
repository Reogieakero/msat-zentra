"use client";
import * as React from "react";
import { useNowTick } from "@/lib/clock";
import { combineDateTime } from "../../referrals/components/guidance-referrals-table";
import type {
  AtRiskStudentItem,
  CounselingSessionType,
  GuidanceInterventionsSummary,
  RiskLevelFilter,
} from "@/services/guidance/interventions.types";
import {
  InterventionDialogs,
} from "./intervention-dialogs";
import { useInterventionDialogState } from "./use-intervention-dialog-state";
import { useInterventionActions } from "./use-intervention-actions";
import { InterventionTableView } from "./intervention-table-view";
export function GuidanceInterventionsTable({
  summary,
  students,
  page,
  pageSize,
  total,
  totalPages,
  unfilteredTotal,
  onPageChange,
  query,
  onQueryChange,
  level,
  onLevelChange,
  onRetry,
  isRetrying,
  isNavigating,
  highlightId = null,
}: GuidanceInterventionsTableProps) {
  const dialogState = useInterventionDialogState(students);
  const {
    dialogs,
    collapsedPlans,
    setCollapsedPlans,
    expandedKey,
    setExpandedKey,
    activeKey,
    activeFollowUpId,
    activeSessionId,
    actionText,
    setActionText,
    priority,
    setPriority,
    intakeNotes,
    setIntakeNotes,
    sessDate,
    setSessDate,
    sessTime,
    setSessTime,
    sessType,
    setSessType,
    sessVenue,
    setSessVenue,
    bookFirst,
    setBookFirst,
    outcomeStatus,
    setOutcomeStatus,
    outcomeNotes,
    setOutcomeNotes,
    activeRow,
    activeFollowUp,
    activeSession,
    closeDialog,
    openStart,
    openChange,
    openOutcome,
    openOutcomeResolved,
    openSchedule,
    openSessionDialog,
    clearActive,
    closeAllDialogs,
  } = dialogState;
  const { invalidateGuidance, actionMutation, isBusy, rowLocked, isActionPending, runAction } =
    useInterventionActions(() => {
      closeAllDialogs();
      clearActive();
    });
  const followUpWhen = bookFirst ? combineDateTime(sessDate, sessTime) : null;
  const now = useNowTick();
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`intervention-row-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, students, page]);
  return (
    <>
      <InterventionTableView
        summary={summary}
        students={students}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        unfilteredTotal={unfilteredTotal}
        onPageChange={onPageChange}
        query={query}
        onQueryChange={onQueryChange}
        level={level}
        onLevelChange={onLevelChange}
        onRetry={onRetry}
        isRetrying={isRetrying}
        isNavigating={isNavigating}
        highlightId={highlightId}
        actionIsError={actionMutation.isError}
        collapsedPlans={collapsedPlans}
        onTogglePlan={(key) =>
          setCollapsedPlans((p) => ({
            ...p,
            [key]: !(p[key] === true),
          }))
        }
        expandedKey={expandedKey}
        onToggleDetails={(key) =>
          setExpandedKey((prev) => (prev === key ? null : key))
        }
        now={now}
        locked={rowLocked}
        isBusy={isBusy}
        isActionPending={isActionPending}
        onStart={openStart}
        onChange={openChange}
        onOutcome={openOutcome}
        onMarkDone={openOutcomeResolved}
        onSchedule={openSchedule}
        onSession={openSessionDialog}
        onReview={(row, decision) =>
          row.intervention &&
          runAction(row.studentKey, "review", {
            followUpId: row.intervention.id,
            decision,
          })
        }
        onDocsChanged={() => {
          invalidateGuidance();
        }}
      />
      <InterventionDialogs
        open={dialogs}
        onClose={closeDialog}
        activeRow={activeRow}
        activeSession={activeSession}
        actionText={actionText}
        onActionText={setActionText}
        priority={priority}
        onPriority={setPriority}
        intakeNotes={intakeNotes}
        onIntakeNotes={setIntakeNotes}
        sessDate={sessDate}
        onSessDate={setSessDate}
        sessTime={sessTime}
        onSessTime={setSessTime}
        sessType={sessType}
        onSessType={setSessType}
        sessVenue={sessVenue}
        onSessVenue={setSessVenue}
        bookFirst={bookFirst}
        onBookFirst={setBookFirst}
        outcomeStatus={outcomeStatus}
        onOutcomeStatus={setOutcomeStatus}
        outcomeNotes={outcomeNotes}
        onOutcomeNotes={setOutcomeNotes}
        isActionPending={isActionPending}
        now={now}
        onSubmitStart={() => {
          if (!activeKey) return;
          runAction(activeKey, "start", {
            recommendedAction: actionText.trim(),
            priority: priority as "low" | "normal" | "high",
            ...(intakeNotes.trim() ? { intakeNotes: intakeNotes.trim() } : {}),
            ...(followUpWhen
              ? {
                  firstSession: {
                    scheduledAt: followUpWhen,
                    sessionType: sessType as CounselingSessionType,
                    ...(sessVenue.trim() ? { venue: sessVenue.trim() } : {}),
                  },
                }
              : {}),
          });
        }}
        onSubmitChange={() => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "review", {
            followUpId: activeFollowUpId,
            decision: "modified",
            recommendedAction: actionText.trim(),
          });
        }}
        onSubmitOutcome={() => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "outcome", {
            followUpId: activeFollowUpId,
            outcomeStatus,
            ...(outcomeNotes.trim()
              ? { outcomeNotes: outcomeNotes.trim() }
              : {}),
          });
        }}
        onSubmitSchedule={(fields) => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "schedule", {
            followUpId: activeFollowUpId,
            scheduledAt: fields.scheduledAt,
            sessionType: fields.sessionType as CounselingSessionType,
            ...(fields.venue ? { venue: fields.venue } : {}),
          });
        }}
        onSubmitFinish={(fields) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "finish", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            sessionNotes: fields.sessionNotes,
            ...(fields.outcome ? { outcome: fields.outcome } : {}),
            ...(fields.followUpSession
              ? {
                  followUpSession: {
                    scheduledAt: fields.followUpSession.scheduledAt,
                    sessionType: fields.followUpSession.sessionType as CounselingSessionType,
                    ...(fields.followUpSession.venue
                      ? { venue: fields.followUpSession.venue }
                      : {}),
                  },
                }
              : {}),
          });
        }}
        onSubmitMove={(scheduledAt) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "move", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            scheduledAt,
          });
        }}
        onSubmitCancelSess={(reason) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "cancelSess", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            ...(reason ? { cancelReason: reason } : {}),
          });
        }}
        canSubmitStart={
          !isActionPending &&
          !!activeKey &&
          actionText.trim() !== "" &&
          (!bookFirst || !!followUpWhen)
        }
        canSubmitChange={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          actionText.trim() !== ""
        }
        canSubmitOutcome={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          !!activeFollowUp &&
          (outcomeStatus === "ongoing" ||
            (outcomeNotes.trim() !== "" &&
              (activeFollowUp.completedSessions > 0 ||
                (outcomeStatus === "unresolved" &&
                  activeRow?.riskLevel === "Low")))) &&
          !(
            activeFollowUp.approvalStatus === "pending" &&
            outcomeStatus !== "ongoing"
          )
        }
      />
    </>
  );
}
interface GuidanceInterventionsTableProps {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unfilteredTotal?: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  level: RiskLevelFilter;
  onLevelChange: (value: RiskLevelFilter) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
  highlightId?: string | null;
}
