"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  venueLabel,
  type AdmMeeting,
} from "../../components/coordinator-data";
import styles from "./coordinator-referrals-outcome-dialog.module.css";

interface CoordinatorReferralsOutcomeDialogProps {
  target: AdmMeeting | null;
  attended: boolean;
  onAttendedChange: (v: boolean) => void;
  minutes: string;
  onMinutesChange: (v: string) => void;
  logbook: string;
  onLogbookChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}

export function CoordinatorReferralsOutcomeDialog({
  target,
  attended,
  onAttendedChange,
  minutes,
  onMinutesChange,
  logbook,
  onLogbookChange,
  onClose,
  onConfirm,
  pending,
}: CoordinatorReferralsOutcomeDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record meeting outcome</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                {venueLabel(target.venue)} on {target.meetingDatetime.slice(0, 10)}.
                Attended meetings log minutes; missed ones route the case to home
                visitation.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className={styles.formGrid}>
          <label
            className={styles.checkRow}
            style={{ cursor: "pointer" }}
            htmlFor="meet-attended"
          >
            <Checkbox
              id="meet-attended"
              checked={attended}
              onCheckedChange={(v) => onAttendedChange(v === true)}
            />
            <span>Parents attended</span>
          </label>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="meet-minutes">
              Minutes of meeting (optional)
            </Label>
            <Textarea
              id="meet-minutes"
              value={minutes}
              onChange={(e) => onMinutesChange(e.target.value)}
              placeholder="What was discussed and agreed…"
            />
          </div>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="meet-out-logbook">
              Attendance logbook ref (optional)
            </Label>
            <Input
              id="meet-out-logbook"
              value={logbook}
              onChange={(e) => onLogbookChange(e.target.value)}
              placeholder="e.g. Logbook p. 42"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            {pending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {pending ? "Saving…" : "Save outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
