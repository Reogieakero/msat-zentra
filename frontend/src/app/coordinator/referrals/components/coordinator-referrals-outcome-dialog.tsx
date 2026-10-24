"use client";

import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import {
  meetingInviteeLabel,
  venueLabel,
} from "@/services/coordinator/labels";
import type { AdmMeeting } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-referrals-outcome-dialog.module.css";

interface CoordinatorReferralsOutcomeDialogProps {
  target: AdmMeeting | null;
  attended: boolean;
  onAttendedChange: (v: boolean) => void;
  minutes: string;
  onMinutesChange: (v: string) => void;
  logbook: string;
  onLogbookChange: (v: string) => void;
  inviteeIds: string[];
  onInviteeIdsChange: (v: string[]) => void;
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
  inviteeIds,
  onInviteeIdsChange,
  onClose,
  onConfirm,
  pending,
}: CoordinatorReferralsOutcomeDialogProps) {
  const invitees = target?.invitees ?? [];
  function toggleInvitee(id: string) {
    onInviteeIdsChange(
      inviteeIds.includes(id)
        ? inviteeIds.filter((x) => x !== id)
        : [...inviteeIds, id],
    );
  }
  return (
    <KanbanOverlay
      open={target !== null}
      onClose={onClose}
      dismissable={!pending}
      width="md"
      title="Record meeting outcome"
      icon={
        <span className="text-primary" aria-hidden>
          <ClipboardCheck size={14} />
        </span>
      }
      description={
        target
          ? `${venueLabel(target.venue)} on ${target.meetingDatetime.slice(0, 10)}. Attended meetings log minutes; missed ones route the case to home visitation.`
          : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-3 text-xs"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-6 px-3 text-xs"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={onConfirm}
            autoFocus
          >
            {pending ? (
              <Loader2
                className="animate-spin"
                style={{ width: "0.875rem", height: "0.875rem" }}
                aria-hidden="true"
              />
            ) : null}
            {pending ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      }
    >
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
          {attended && invitees.length > 0 ? (
            <div className={styles.formField}>
              <span className={styles.formLabel} id="meet-invitees-label">
                Invited staff who attended
                {inviteeIds.length > 0 ? ` · ${inviteeIds.length} present` : ""}
              </span>
              <div role="group" aria-labelledby="meet-invitees-label">
                {invitees.map((u) => {
                  const checked = inviteeIds.includes(u.id);
                  return (
                    <label key={u.id} className={styles.checkRow} style={{ cursor: "pointer" }}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          toggleInvitee(u.id)
                        }
                        aria-label={`Mark ${u.fullName} attended`}
                      />
                      <span>{meetingInviteeLabel(u)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
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
    </KanbanOverlay>
  );
}
