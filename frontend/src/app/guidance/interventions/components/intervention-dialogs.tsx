"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDropdown } from "../../referrals/components/form-dropdown";
import {
  SessionDatePicker,
  SessionTimePicker,
} from "../../referrals/components/session-datetime-picker";
import { SESSION_KIND_OPTIONS } from "../../referrals/components/guidance-referrals-table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  InterventionOutcome,
} from "./guidance-interventions-data";
import { Busy } from "./busy";
import styles from "./intervention-dialogs.module.css";

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
  doneNotes: string;
  onDoneNotes: (value: string) => void;
  doneOutcome: string;
  onDoneOutcome: (value: string) => void;
  cancelReasonInput: string;
  onCancelReasonInput: (value: string) => void;
  outcomeStatus: InterventionOutcome;
  onOutcomeStatus: (value: InterventionOutcome) => void;
  outcomeNotes: string;
  onOutcomeNotes: (value: string) => void;
  isActionPending: boolean;
  onSubmitStart: () => void;
  onSubmitChange: () => void;
  onSubmitOutcome: () => void;
  onSubmitSchedule: () => void;
  onSubmitFinish: () => void;
  onSubmitMove: () => void;
  onSubmitCancelSess: () => void;
  canSubmitStart: boolean;
  canSubmitChange: boolean;
  canSubmitOutcome: boolean;
  canSubmitSchedule: boolean;
  canSubmitFinish: boolean;
  canSubmitMove: boolean;
  canSubmitCancelSess: boolean;
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
  doneNotes,
  onDoneNotes,
  doneOutcome,
  onDoneOutcome,
  cancelReasonInput,
  onCancelReasonInput,
  outcomeStatus,
  onOutcomeStatus,
  outcomeNotes,
  onOutcomeNotes,
  isActionPending,
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
  canSubmitSchedule,
  canSubmitFinish,
  canSubmitMove,
  canSubmitCancelSess,
}: InterventionDialogsProps) {
  const followUp = activeRow?.intervention ?? null;

  return (
    <>
      <Dialog open={open.start} onOpenChange={(n) => !n && onClose("start")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Start a follow-up{activeRow ? ` — ${activeRow.student}` : ""}
            </DialogTitle>
            <DialogDescription>
              Set the urgency, record your first impressions, and book the
              first counseling session. It starts assigned to you.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.formFull}>
              <Label htmlFor="startAction">What will you do?</Label>
              <Textarea
                id="startAction"
                value={actionText}
                onChange={(e) => onActionText(e.target.value)}
                placeholder="e.g. Weekly one-on-one every Friday, call parents about attendance…"
                maxLength={2000}
              />
            </div>
            <FormDropdown
              id="startPriority"
              label="How urgent is this?"
              value={priority}
              onChange={onPriority}
              placeholder="Pick urgency"
              options={[
                { value: "high", label: "High — act right away" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low — monitor for now" },
              ]}
            />
            <div className={styles.formFull}>
              <Label htmlFor="startIntake">First impressions (optional)</Label>
              <Textarea
                id="startIntake"
                value={intakeNotes}
                onChange={(e) => onIntakeNotes(e.target.value)}
                placeholder="What stands out? Anything the next reader should know…"
                maxLength={2000}
              />
            </div>
            <div className={styles.formFull}>
              <p className={styles.formSectionLabel}>First session (optional)</p>
            </div>
            <SessionDatePicker
              id="startSessDate"
              label="Date"
              value={sessDate}
              onChange={onSessDate}
            />
            <SessionTimePicker
              id="startSessTime"
              label="Time"
              value={sessTime}
              onChange={onSessTime}
            />
            <FormDropdown
              id="startSessType"
              label="Session kind"
              value={sessType}
              onChange={onSessType}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="startSessVenue">Venue (optional)</Label>
              <Input
                id="startSessVenue"
                value={sessVenue}
                onChange={(e) => onSessVenue(e.target.value)}
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("start")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmitStart} onClick={onSubmitStart}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Starting…" : "Start follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open.change} onOpenChange={(n) => !n && onClose("change")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change the follow-up plan</DialogTitle>
            <DialogDescription>
              {activeRow
                ? `Adjust what should happen for ${activeRow.student}. This counts as your review.`
                : "Adjust the recommended action."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="changedAction">Adjusted action</Label>
            <Textarea
              id="changedAction"
              value={actionText}
              onChange={(e) => onActionText(e.target.value)}
              placeholder="Write what should happen instead…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("change")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmitChange} onClick={onSubmitChange}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Save change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open.outcome}
        onOpenChange={(n) => !n && onClose("outcome")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record the outcome</DialogTitle>
            <DialogDescription>
              Closing needs two things: at least one finished session and a
              closing note.
            </DialogDescription>
          </DialogHeader>
          <p className={styles.resolveProgress} aria-live="polite">
            {followUp
              ? `${followUp.completedSessions} of ${followUp.sessions.length} session${followUp.sessions.length === 1 ? "" : "s"} finished`
              : "No follow-up selected"}
          </p>
          {followUp && followUp.completedSessions === 0 ? (
            <p className={styles.blocker} role="note">
              Finish at least one session first — schedule one in the
              counseling plan above, then mark it done.
            </p>
          ) : null}
          {followUp?.approvalStatus === "pending" ? (
            <p className={styles.blocker} role="note">
              Review this follow-up first — it can only be closed after
              approval. You can still save a progress note as “Still ongoing”.
            </p>
          ) : null}
          <div className={styles.formGrid}>
            <FormDropdown
              id="outcomeStatus"
              label="Where does this stand?"
              value={outcomeStatus}
              onChange={(v) => onOutcomeStatus(v as InterventionOutcome)}
              placeholder="Pick a status"
              options={[
                { value: "ongoing", label: "Still ongoing" },
                { value: "resolved", label: "Resolved — goal met" },
                { value: "unresolved", label: "Closed — not resolved" },
              ]}
            />
            <div className={styles.formFull}>
              <Label htmlFor="outcomeNotes">
                Progress note (required when closing)
              </Label>
              <Textarea
                id="outcomeNotes"
                value={outcomeNotes}
                onChange={(e) => onOutcomeNotes(e.target.value)}
                placeholder="What changed for the student? What was the final outcome…"
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("outcome")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmitOutcome} onClick={onSubmitOutcome}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open.schedule}
        onOpenChange={(n) => !n && onClose("schedule")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a session</DialogTitle>
            <DialogDescription>
              {activeRow
                ? `Book a counseling session for ${activeRow.student}.`
                : "Book a counseling session."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="ivSessDate"
              label="Date"
              value={sessDate}
              onChange={onSessDate}
            />
            <SessionTimePicker
              id="ivSessTime"
              label="Time"
              value={sessTime}
              onChange={onSessTime}
            />
            <FormDropdown
              id="ivSessType"
              label="Session kind"
              value={sessType}
              onChange={onSessType}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="ivSessVenue">Venue (optional)</Label>
              <Input
                id="ivSessVenue"
                value={sessVenue}
                onChange={(e) => onSessVenue(e.target.value)}
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("schedule")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmitSchedule} onClick={onSubmitSchedule}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Scheduling…" : "Schedule session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open.finish} onOpenChange={(n) => !n && onClose("finish")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark session done</DialogTitle>
            <DialogDescription>
              {activeSession
                ? "Record what happened. If another talk is needed, book the follow-up below — otherwise, if this is the last open session, the follow-up closes on its own."
                : "Record what happened in this session."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.formFull}>
              <Label htmlFor="ivDoneNotes">What happened in the session?</Label>
              <Textarea
                id="ivDoneNotes"
                value={doneNotes}
                onChange={(e) => onDoneNotes(e.target.value)}
                placeholder="Key points discussed, student response…"
                maxLength={5000}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="ivDoneOutcome">
                Outcome / next step (optional)
              </Label>
              <Textarea
                id="ivDoneOutcome"
                value={doneOutcome}
                onChange={(e) => onDoneOutcome(e.target.value)}
                placeholder="What changed? What happens next…"
                maxLength={2000}
              />
            </div>
            <div className={styles.formFull}>
              <p className={styles.formSectionLabel}>
                Book a follow-up session (optional)
              </p>
              <p className={styles.formSectionHint}>
                If this needs another talk, book it now so it stays on the plan.
              </p>
            </div>
            <SessionDatePicker
              id="ivFollowDate"
              label="Follow-up date"
              value={sessDate}
              onChange={onSessDate}
            />
            <SessionTimePicker
              id="ivFollowTime"
              label="Follow-up time"
              value={sessTime}
              onChange={onSessTime}
            />
            <FormDropdown
              id="ivFollowType"
              label="Follow-up kind"
              value={sessType}
              onChange={onSessType}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="ivFollowVenue">Venue (optional)</Label>
              <Input
                id="ivFollowVenue"
                value={sessVenue}
                onChange={(e) => onSessVenue(e.target.value)}
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("finish")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button disabled={!canSubmitFinish} onClick={onSubmitFinish}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Mark done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open.move} onOpenChange={(n) => !n && onClose("move")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move session</DialogTitle>
            <DialogDescription>Pick the new date and time.</DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="ivMoveDate"
              label="New date"
              value={sessDate}
              onChange={onSessDate}
            />
            <SessionTimePicker
              id="ivMoveTime"
              label="New time"
              value={sessTime}
              onChange={onSessTime}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("move")}
              disabled={isActionPending}
            >
              Keep as is
            </Button>
            <Button disabled={!canSubmitMove} onClick={onSubmitMove}>
              <Busy busy={isActionPending} />
              {isActionPending ? "Moving…" : "Move session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open.cancelSess}
        onOpenChange={(n) => !n && onClose("cancelSess")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              This session will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="ivCancelReason">Why? (optional)</Label>
            <Textarea
              id="ivCancelReason"
              value={cancelReasonInput}
              onChange={(e) => onCancelReasonInput(e.target.value)}
              placeholder="e.g. Student was absent, moved to next week…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onClose("cancelSess")}
              disabled={isActionPending}
            >
              Keep session
            </Button>
            <Button
              disabled={!canSubmitCancelSess}
              onClick={onSubmitCancelSess}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Cancelling…" : "Cancel session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
