"use client";
import type { BookSessionFields } from "@/components/session-booking/BookSessionDialog";
import type { FinishSessionFields } from "@/components/session-booking/FinishSessionDialog";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  InterventionOutcome,
} from "@/services/guidance/interventions.types";
import { InterventionStartDialog } from "./intervention-start-dialog";
import { InterventionChangeDialog } from "./intervention-change-dialog";
import { InterventionOutcomeDialog } from "./intervention-outcome-dialog";
import { InterventionScheduleDialog } from "./intervention-schedule-dialog";
import { InterventionFinishDialog } from "./intervention-finish-dialog";
import { InterventionMoveDialog } from "./intervention-move-dialog";
import { InterventionCancelDialog } from "./intervention-cancel-dialog";
export type InterventionDialogKey =
  | "start"
  | "change"
  | "outcome"
  | "schedule"
  | "finish"
  | "move"
  | "cancelSess";
interface InterventionDialogsProps {
  open: Record<InterventionDialogKey, boolean>;
  onClose: (dialog: InterventionDialogKey) => void;
  activeRow: AtRiskStudentItem | null;
  activeSession: CounselingSessionItem | null;
  actionText: string;
  onActionText: (value: string) => void;
  priority: string;
  onPriority: (value: string) => void;
  intakeNotes: string;
  onIntakeNotes: (value: string) => void;
  sessDate: string;
  onSessDate: (value: string) => void;
  sessTime: string;
  onSessTime: (value: string) => void;
  sessType: string;
  onSessType: (value: string) => void;
  sessVenue: string;
  onSessVenue: (value: string) => void;
  outcomeStatus: InterventionOutcome;
  onOutcomeStatus: (value: InterventionOutcome) => void;
  outcomeNotes: string;
  onOutcomeNotes: (value: string) => void;
  isActionPending: boolean;
  now: number;
  onSubmitStart: () => void;
  onSubmitChange: () => void;
  onSubmitOutcome: () => void;
  onSubmitSchedule: (fields: BookSessionFields) => void;
  onSubmitFinish: (fields: FinishSessionFields) => void;
  onSubmitMove: (scheduledAt: string) => void;
  onSubmitCancelSess: (reason?: string) => void;
  canSubmitStart: boolean;
  canSubmitChange: boolean;
  canSubmitOutcome: boolean;
}
export function InterventionDialogs({
  open,
  onClose,
  activeRow,
  activeSession,
  actionText,
  onActionText,
  priority,
  onPriority,
  intakeNotes,
  onIntakeNotes,
  sessDate,
  onSessDate,
  sessTime,
  onSessTime,
  sessType,
  onSessType,
  sessVenue,
  onSessVenue,
  outcomeStatus,
  onOutcomeStatus,
  outcomeNotes,
  onOutcomeNotes,
  isActionPending,
  now,
  onSubmitStart,
  onSubmitChange,
  onSubmitOutcome,
  onSubmitSchedule,
  onSubmitFinish,
  onSubmitMove,
  onSubmitCancelSess,
  canSubmitStart,
  canSubmitChange,
  canSubmitOutcome,
}: InterventionDialogsProps) {
  const followUp = activeRow?.intervention ?? null;
  return (
    <>
      <InterventionStartDialog
        open={open.start}
        onClose={() => onClose("start")}
        activeStudent={activeRow?.student ?? null}
        actionText={actionText}
        onActionText={onActionText}
        priority={priority}
        onPriority={onPriority}
        intakeNotes={intakeNotes}
        onIntakeNotes={onIntakeNotes}
        sessDate={sessDate}
        onSessDate={onSessDate}
        sessTime={sessTime}
        onSessTime={onSessTime}
        sessType={sessType}
        onSessType={onSessType}
        sessVenue={sessVenue}
        onSessVenue={onSessVenue}
        isActionPending={isActionPending}
        onSubmit={onSubmitStart}
        canSubmit={canSubmitStart}
      />
      <InterventionChangeDialog
        open={open.change}
        onClose={() => onClose("change")}
        activeStudent={activeRow?.student ?? null}
        actionText={actionText}
        onActionText={onActionText}
        isActionPending={isActionPending}
        onSubmit={onSubmitChange}
        canSubmit={canSubmitChange}
      />
      <InterventionOutcomeDialog
        open={open.outcome}
        onClose={() => onClose("outcome")}
        activeRow={activeRow}
        followUp={followUp}
        outcomeStatus={outcomeStatus}
        onOutcomeStatus={onOutcomeStatus}
        outcomeNotes={outcomeNotes}
        onOutcomeNotes={onOutcomeNotes}
        isActionPending={isActionPending}
        onSubmit={onSubmitOutcome}
        canSubmit={canSubmitOutcome}
      />
      <InterventionScheduleDialog
        open={open.schedule}
        onClose={() => onClose("schedule")}
        activeStudent={activeRow?.student ?? null}
        hasActiveSession={
          !!activeRow?.intervention?.sessions.some((s) => s.status === "scheduled")
        }
        isActionPending={isActionPending}
        onSubmit={onSubmitSchedule}
      />
      <InterventionFinishDialog
        open={open.finish}
        onClose={() => onClose("finish")}
        activeSession={activeSession}
        now={now}
        isActionPending={isActionPending}
        onSubmit={onSubmitFinish}
      />
      <InterventionMoveDialog
        open={open.move}
        onClose={() => onClose("move")}
        activeSession={activeSession}
        isActionPending={isActionPending}
        onSubmit={onSubmitMove}
      />
      <InterventionCancelDialog
        open={open.cancelSess}
        onClose={() => onClose("cancelSess")}
        isActionPending={isActionPending}
        onSubmit={onSubmitCancelSess}
      />
    </>
  );
}
