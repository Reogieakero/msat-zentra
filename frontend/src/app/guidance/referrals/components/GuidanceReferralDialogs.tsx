"use client";

import { Loader2 } from "lucide-react";
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
import type {
  CounselingSessionItem,
  CounselingSessionType,
  GuidanceReferralItem,
} from "./guidance-referrals-data";
import {
  SESSION_KIND_OPTIONS,
  combineDateTime,
  formatDateTime,
  sessionTypeLabel,
} from "./guidance-referrals-format";
import {
  SessionDatePicker,
  SessionTimePicker,
} from "./session-datetime-picker";
import { FormDropdown } from "./form-dropdown";
import styles from "./GuidanceReferralDialogs.module.css";

export interface GuidanceActionDialogs {
  escalate: boolean;
  reassign: boolean;
  note: boolean;
  followUp: boolean;
  dismiss: boolean;
  specialist: boolean;
  adm: boolean;
  accept: boolean;
  schedule: boolean;
  finish: boolean;
  move: boolean;
  cancelSess: boolean;
  deleteSess: boolean;
  resolve: boolean;
}

export type GuidanceDialogKey = keyof GuidanceActionDialogs;

export interface GuidanceActionFormState {
  escalationReason: string;
  escalatedTo: string;
  noteText: string;
  followUpDate: string;
  dismissReason: string;
  specialistRole: string;
  specialistReason: string;
  admReason: string;
  priority: string;
  intakeNotes: string;
  sessDate: string;
  sessTime: string;
  sessType: string;
  sessVenue: string;
  doneNotes: string;
  doneOutcome: string;
  cancelReasonInput: string;
  resolveSummary: string;
}

export const INITIAL_GUIDANCE_FORM: GuidanceActionFormState = {
  escalationReason: "",
  escalatedTo: "",
  noteText: "",
  followUpDate: "",
  dismissReason: "",
  specialistRole: "",
  specialistReason: "",
  admReason: "",
  priority: "normal",
  intakeNotes: "",
  sessDate: "",
  sessTime: "",
  sessType: "individual",
  sessVenue: "",
  doneNotes: "",
  doneOutcome: "",
  cancelReasonInput: "",
  resolveSummary: "",
};

/* Spinner shown inside a button while its action is running. The button
   text already flips ("Saving…"), so this is purely visual. */
function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className={styles.spin} aria-hidden="true" />;
}

/**
 * Every role-based dialog on the guidance referrals page (accept, schedule,
 * finish, move, cancel/delete session, resolve, escalate, reassign, note,
 * follow-up, dismiss, specialist, ADM) — same flow and button labels as
 * the nurse dialogs, gated by the guidance_counselor role server-side.
 */
export function GuidanceReferralDialogs({
  dialogs,
  form,
  setForm,
  activeRow,
  activeSession,
  isActionPending,
  mutationIsPending,
  closeDialog,
  handleAction,
  onResolveCase,
}: {
  dialogs: GuidanceActionDialogs;
  form: GuidanceActionFormState;
  setForm: React.Dispatch<React.SetStateAction<GuidanceActionFormState>>;
  activeRow: GuidanceReferralItem | null;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  mutationIsPending: boolean;
  closeDialog: (dialog: GuidanceDialogKey) => void;
  handleAction: (action: string, payload: unknown) => void;
  onResolveCase: (id: string, summary: string) => void;
}) {
  return (
    <>
      {/* Escalate Dialog */}
      <Dialog
        open={dialogs.escalate}
        onOpenChange={() => closeDialog("escalate")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Send to a higher office</DialogTitle>
            <DialogDescription>
              Send this case up when it needs attention beyond guidance.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div>
              <FormDropdown
                id="escalatedTo"
                label="Send to"
                value={form.escalatedTo}
                onChange={(v) => setForm((f) => ({ ...f, escalatedTo: v }))}
                placeholder="Pick an office"
                options={[
                  { value: "principal", label: "Principal" },
                  { value: "nurse", label: "Nurse" },
                  { value: "adm_coordinator", label: "ADM Coordinator" },
                ]}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="escalationReason">Why does this need to go higher?</Label>
              <Textarea
                id="escalationReason"
                value={form.escalationReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, escalationReason: e.target.value }))
                }
                placeholder="Explain what is happening and what help is needed…"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("escalate")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending ||
                !form.escalatedTo ||
                !form.escalationReason
              }
              onClick={() =>
                handleAction("escalate", {
                  escalationReason: form.escalationReason,
                  escalatedTo: form.escalatedTo,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Sending…" : "Send up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog
        open={dialogs.reassign}
        onOpenChange={() => closeDialog("reassign")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Pass to someone else</DialogTitle>
            <DialogDescription>
              Hand this case to another office. It will show up in their queue.
            </DialogDescription>
          </DialogHeader>
          <div>
            <FormDropdown
              id="reassignRole"
              label="Pass to"
              value={form.specialistRole}
              onChange={(v) => setForm((f) => ({ ...f, specialistRole: v }))}
              placeholder="Pick an office"
              options={[
                { value: "nurse", label: "Nurse" },
                { value: "guidance_counselor", label: "Guidance Counselor" },
                { value: "adm_coordinator", label: "ADM Coordinator" },
                { value: "principal", label: "Principal" },
              ]}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("reassign")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.specialistRole}
              onClick={() =>
                handleAction("reassign", {
                  referredToRole: form.specialistRole,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Passing…" : "Pass case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={dialogs.note} onOpenChange={() => closeDialog("note")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Add a private note</DialogTitle>
            <DialogDescription>
              Only guidance staff can see this note.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="noteText">Note</Label>
            <Textarea
              id="noteText"
              value={form.noteText}
              onChange={(e) =>
                setForm((f) => ({ ...f, noteText: e.target.value }))
              }
                placeholder="Write your note here…"
                maxLength={2000}
              />
            </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("note")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.noteText}
              onClick={() => handleAction("note", { notes: form.noteText })}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog
        open={dialogs.followUp}
        onOpenChange={() => closeDialog("followUp")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Set a check-back reminder</DialogTitle>
            <DialogDescription>
              Pick a date to come back to this case.
            </DialogDescription>
          </DialogHeader>
          <div>
            <SessionDatePicker
              id="followUpDate"
              label="Check back on"
              value={form.followUpDate}
              onChange={(v) => setForm((f) => ({ ...f, followUpDate: v }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("followUp")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.followUpDate}
              onClick={() =>
                handleAction("followUp", { followUpDate: form.followUpDate })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Setting…" : "Set reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Dialog */}
      <Dialog
        open={dialogs.dismiss}
        onOpenChange={() => closeDialog("dismiss")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Close without action</DialogTitle>
            <DialogDescription>
              Close this case. Please say why, so there is a record.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="dismissReason">Why is this being closed?</Label>
              <Textarea
                id="dismissReason"
                value={form.dismissReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dismissReason: e.target.value }))
                }
                placeholder="Explain why no further action is needed…"
                maxLength={500}
              />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("dismiss")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.dismissReason}
              onClick={() =>
                handleAction("dismiss", { reason: form.dismissReason })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Closing…" : "Close case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialist Dialog */}
      <Dialog
        open={dialogs.specialist}
        onOpenChange={() => closeDialog("specialist")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Ask a specialist for help</DialogTitle>
            <DialogDescription>
              Send this case to a specialist office.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div>
              <FormDropdown
                id="specialistRole"
                label="Send to"
                value={form.specialistRole}
                onChange={(v) =>
                  setForm((f) => ({ ...f, specialistRole: v }))
                }
                placeholder="Pick a specialist"
                options={[
                  { value: "nurse", label: "Nurse" },
                  { value: "adm_coordinator", label: "ADM Coordinator" },
                  { value: "principal", label: "Principal" },
                ]}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="specialistReason">What help is needed?</Label>
              <Textarea
                id="specialistReason"
                value={form.specialistReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specialistReason: e.target.value }))
                }
                placeholder="Explain what help the student needs…"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("specialist")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending ||
                !form.specialistRole ||
                !form.specialistReason
              }
              onClick={() =>
                handleAction("specialist", {
                  referredToRole: form.specialistRole,
                  reason: form.specialistReason,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADM Dialog */}
      <Dialog open={dialogs.adm} onOpenChange={() => closeDialog("adm")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Start ADM process</DialogTitle>
            <DialogDescription>
              Move this case into ADM (Alternative Dispute Resolution) for
              closer follow-through.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="admReason">Why does this case need ADM?</Label>
              <Textarea
                id="admReason"
                value={form.admReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, admReason: e.target.value }))
                }
                placeholder="Explain why this case needs closer follow-through…"
                maxLength={500}
              />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("adm")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.admReason}
              onClick={() => handleAction("adm", { reason: form.admReason })}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Starting…" : "Start ADM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept with intake */}
      <Dialog open={dialogs.accept} onOpenChange={() => closeDialog("accept")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Accept this case{activeRow ? ` — ${activeRow.student}` : ""}</DialogTitle>
            <DialogDescription>
              Record your first impressions and book the first counseling
              session. You can schedule more sessions afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <FormDropdown
              id="priority"
              label="How urgent is this?"
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              placeholder="Pick urgency"
              options={[
                { value: "high", label: "High — act right away" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low — monitor for now" },
              ]}
            />
            <div className={styles.formFull}>
              <Label htmlFor="intakeNotes">First impressions (optional)</Label>
              <Textarea
                id="intakeNotes"
                value={form.intakeNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intakeNotes: e.target.value }))
                }
                placeholder="What stands out? Anything the next reader should know…"
                maxLength={2000}
              />
            </div>
            <div className={styles.formFull}>
              <p className={styles.formSectionLabel}>First session (optional)</p>
            </div>
            <SessionDatePicker
              id="firstDate"
              label="Date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="firstTime"
              label="Time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="firstType"
              label="Session kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="firstVenue">Venue (optional)</Label>
              <Input
                id="firstVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("accept")}
              disabled={isActionPending}
            >
              Not yet
            </Button>
            <Button
              disabled={isActionPending}
              onClick={() => {
                const when =
                  form.sessDate && form.sessTime
                    ? combineDateTime(form.sessDate, form.sessTime)
                    : null;
                handleAction("accept", {
                  priority: form.priority as "low" | "normal" | "high",
                  ...(form.intakeNotes.trim()
                    ? { intakeNotes: form.intakeNotes.trim() }
                    : {}),
                  ...(when
                    ? {
                        firstSession: {
                          scheduledAt: when,
                          sessionType: form.sessType as CounselingSessionType,
                          ...(form.sessVenue.trim()
                            ? { venue: form.sessVenue.trim() }
                            : {}),
                        },
                      }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Accepting…" : "Accept and start case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule a session */}
      <Dialog open={dialogs.schedule} onOpenChange={() => closeDialog("schedule")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Schedule a session</DialogTitle>
            <DialogDescription>
              Book a counseling session{activeRow ? ` for ${activeRow.student}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="sessDate"
              label="Date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="sessTime"
              label="Time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="sessType"
              label="Session kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="sessVenue">Venue (optional)</Label>
              <Input
                id="sessVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("schedule")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending || !combineDateTime(form.sessDate, form.sessTime)
              }
              onClick={() => {
                const when = combineDateTime(form.sessDate, form.sessTime);
                if (!when) return;
                handleAction("schedule", {
                  scheduledAt: when,
                  sessionType: form.sessType as CounselingSessionType,
                  ...(form.sessVenue.trim()
                    ? { venue: form.sessVenue.trim() }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Scheduling…" : "Schedule session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark a session done */}
      <Dialog open={dialogs.finish} onOpenChange={() => closeDialog("finish")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Mark session done</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)}${activeSession.venue ? ` · ${activeSession.venue}` : ""}`
                : "Record what happened in this session."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.formFull}>
              <Label htmlFor="doneNotes">What happened in the session?</Label>
              <Textarea
                id="doneNotes"
                value={form.doneNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, doneNotes: e.target.value }))
                }
                placeholder="Key points discussed, student response…"
                maxLength={5000}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="doneOutcome">Outcome / next step (optional)</Label>
              <Textarea
                id="doneOutcome"
                value={form.doneOutcome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, doneOutcome: e.target.value }))
                }
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
              id="followUpSessDate"
              label="Follow-up date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="followUpSessTime"
              label="Follow-up time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="followUpSessType"
              label="Follow-up kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="followUpSessVenue">Venue (optional)</Label>
              <Input
                id="followUpSessVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className={styles.btnRed}
              onClick={() => closeDialog("finish")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.doneNotes.trim() || !activeSession?.id}
              onClick={() => {
                if (!activeSession?.id) return;
                const followUpAt = combineDateTime(form.sessDate, form.sessTime);
                handleAction("finish", {
                  sessionId: activeSession?.id,
                  sessionNotes: form.doneNotes.trim(),
                  ...(form.doneOutcome.trim()
                    ? { outcome: form.doneOutcome.trim() }
                    : {}),
                  ...(followUpAt
                    ? {
                        followUpSession: {
                          scheduledAt: followUpAt,
                          sessionType:
                            form.sessType as CounselingSessionType,
                          ...(form.sessVenue.trim()
                            ? { venue: form.sessVenue.trim() }
                            : {}),
                        },
                      }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Mark done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move a session */}
      <Dialog open={dialogs.move} onOpenChange={() => closeDialog("move")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Move session</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `Currently ${formatDateTime(activeSession.scheduledAt)}. Pick the new date and time.`
                : "Pick the new date and time."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="moveDate"
              label="New date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="moveTime"
              label="New time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("move")}
              disabled={isActionPending}
            >
              Keep as is
            </Button>
            <Button
              disabled={
                isActionPending ||
                !activeSession?.id ||
                !combineDateTime(form.sessDate, form.sessTime)
              }
              onClick={() => {
                const when = combineDateTime(form.sessDate, form.sessTime);
                if (!when || !activeSession?.id) return;
                handleAction("move", { sessionId: activeSession?.id, scheduledAt: when });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Moving…" : "Move session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel a session */}
      <Dialog
        open={dialogs.cancelSess}
        onOpenChange={() => closeDialog("cancelSess")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)} will be cancelled.`
                : "This session will be cancelled."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="cancelReasonInput">Why? (optional)</Label>
            <Textarea
              id="cancelReasonInput"
              value={form.cancelReasonInput}
              onChange={(e) =>
                setForm((f) => ({ ...f, cancelReasonInput: e.target.value }))
              }
              placeholder="e.g. Student was absent, moved to next week…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("cancelSess")}
              disabled={isActionPending}
            >
              Keep session
            </Button>
            <Button
              variant="destructive"
              className={styles.btnRed}
              disabled={isActionPending || !activeSession?.id}
              onClick={() =>
                activeSession?.id &&
                handleAction("cancelSess", {
                  sessionId: activeSession?.id,
                  ...(form.cancelReasonInput.trim()
                    ? { cancelReason: form.cancelReasonInput.trim() }
                    : {}),
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Cancelling…" : "Cancel session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete a cancelled session — permanent, case stays open */}
      <Dialog
        open={dialogs.deleteSess}
        onOpenChange={() => closeDialog("deleteSess")}
      >
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Delete cancelled session?</DialogTitle>
            <DialogDescription>
              This permanently removes the cancelled session from the list.
              The case itself stays open. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("deleteSess")}
              disabled={isActionPending}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              className={styles.btnRed}
              disabled={isActionPending || !activeSession?.id}
              onClick={() =>
                activeSession?.id &&
                handleAction("deleteSess", { sessionId: activeSession?.id })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Deleting…" : "Delete session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish & close with strict requirements */}
      <Dialog open={dialogs.resolve} onOpenChange={() => closeDialog("resolve")}>
        <DialogContent className={styles.dialogScrollHidden}>
          <DialogHeader>
            <DialogTitle>Finish and close case</DialogTitle>
            <DialogDescription>
              Closing needs two things: at least one finished session and a
              closing summary.
            </DialogDescription>
          </DialogHeader>
          <p className={styles.resolveProgress} aria-live="polite">
            {activeRow
              ? `${activeRow.completedSessions} of ${activeRow.sessions.length} session${activeRow.sessions.length === 1 ? "" : "s"} finished`
              : "No case selected"}
          </p>
          {activeRow && activeRow.completedSessions === 0 ? (
            <p className={styles.resolveBlocker} role="note">
              Finish at least one session first — use “Schedule a session” in
              the counseling plan, then mark it done.
            </p>
          ) : null}
          <div>
            <Label htmlFor="resolveSummary">Closing summary</Label>
            <Textarea
              id="resolveSummary"
              value={form.resolveSummary}
              onChange={(e) =>
                setForm((f) => ({ ...f, resolveSummary: e.target.value }))
              }
              placeholder="What changed for the student? What was the final outcome…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("resolve")}
              disabled={mutationIsPending}
            >
              Keep open
            </Button>
            <Button
              disabled={
                mutationIsPending ||
                isActionPending ||
                !activeRow ||
                !form.resolveSummary.trim() ||
                activeRow.completedSessions === 0
              }
              onClick={() => {
                if (!activeRow) return;
                onResolveCase(activeRow.id, form.resolveSummary.trim());
              }}
            >
              <Busy busy={mutationIsPending} />
              {mutationIsPending ? "Closing…" : "Close case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}