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
import type { CounselingSessionType } from "@/services/guidance/guidance.types";
import { SESSION_KIND_OPTIONS, combineDateTime } from "./guidance-referrals-format";
import { SessionDatePicker, SessionTimePicker } from "./session-datetime-picker";
import { FormDropdown } from "./form-dropdown";
import type { GuidanceDialogProps } from "./guidance-dialog-props";
import styles from "./GuidanceReferralDialogs.module.css";
export function AcceptDialog({
  dialogs,
  form,
  setForm,
  activeRow,
  isActionPending,
  closeDialog,
  handleAction,
}: GuidanceDialogProps) {
  return (
    <Dialog open={dialogs.accept} onOpenChange={(next) => { if (!next && isActionPending) return; closeDialog("accept") }}>
      <DialogContent
        className={styles.dialogScrollHidden}
        aria-busy={isActionPending || undefined}
      >
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
          <Button aria-busy={isActionPending || undefined}
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
            {isActionPending ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {isActionPending ? "Accepting…" : "Accept and start case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
