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
import { SESSION_KIND_OPTIONS } from "@/lib/labels/sessions";
import { Busy } from "./busy";
import styles from "./intervention-dialogs.module.css";
export function InterventionStartDialog({
  open,
  onClose,
  activeStudent,
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
  isActionPending,
  onSubmit,
  canSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeStudent: string | null;
  actionText: string;
  onActionText: (v: string) => void;
  priority: string;
  onPriority: (v: string) => void;
  intakeNotes: string;
  onIntakeNotes: (v: string) => void;
  sessDate: string;
  onSessDate: (v: string) => void;
  sessTime: string;
  onSessTime: (v: string) => void;
  sessType: string;
  onSessType: (v: string) => void;
  sessVenue: string;
  onSessVenue: (v: string) => void;
  isActionPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(n) => { if (!n && !isActionPending) onClose() }}>
      <DialogContent aria-busy={isActionPending || undefined}>
        <DialogHeader>
          <DialogTitle>
            Start a follow-up{activeStudent ? ` — ${activeStudent}` : ""}
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
            onClick={onClose}
            disabled={isActionPending}
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            <Busy busy={isActionPending} />
            {isActionPending ? "Starting…" : "Start follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
