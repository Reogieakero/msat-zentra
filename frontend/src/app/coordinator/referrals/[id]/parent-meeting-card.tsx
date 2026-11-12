"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { friendlyWords, venueLabel } from "@/services/coordinator/labels";
import styles from "./case-page.module.css";
import {
  formatCountdown,
  useMeetingTiming,
  type ParentMeetingItem,
} from "./components/use-meeting-timing";
import { useMeetingOutcome } from "./components/use-meeting-outcome";
import { AttendanceLogModal } from "./components/attendance-log-modal";
import { OutcomeDialog } from "./components/outcome-dialog";
export type { ParentMeetingItem } from "./components/use-meeting-timing";
export function ParentMeetingCard({
  meeting: m,
  now,
  isLatest,
  active,
  onChanged,
  onAttendedConfirmed,
}: {
  meeting: ParentMeetingItem;
  now: number;
  isLatest: boolean;
  active: boolean;
  onChanged: () => void;
  onAttendedConfirmed: () => void;
}) {
  const { timing, showCountdown, showOutcomeRecords, needsOutcome, needsAction } =
    useMeetingTiming(m, now, isLatest);
  const outcome = useMeetingOutcome(m, onChanged, onAttendedConfirmed);
  const [wasNeedingOutcome, setWasNeedingOutcome] = React.useState(false);
  if (needsAction !== wasNeedingOutcome) {
    setWasNeedingOutcome(needsAction);
    if (needsAction && !outcome.dialogOpen) {
      outcome.setStep("idle");
      outcome.setError(null);
      outcome.setDialogOpen(true);
    }
  }
  return (
    <li
      className={styles.evidenceItem}
      style={{
        alignItems: "flex-start",
        flexDirection: "column",
        flex: 1,
        display: active ? undefined : "none",
      }}
      aria-hidden={active ? undefined : true}
    >
      <div className={styles.badgeRow} style={{ marginTop: 0 }}>
        <Pill tone="neutral" label="Venue">
          {venueLabel(m.venue)}
        </Pill>
        {m.attended ? (
          <Pill tone="green" label="Attendance">
            Attended
          </Pill>
        ) : (
          <Pill tone="blue" label="Meeting status">
            Booked
          </Pill>
        )}
        {showCountdown && timing.state === "upcoming" ? (
          <Pill tone="amber" label="Time until start">
            Starts in {formatCountdown(timing.msUntil)}
          </Pill>
        ) : null}
        {timing.state === "live" ? (
          <Pill tone="green" label="Meeting status">
            Live now
          </Pill>
        ) : null}
        {showCountdown && timing.state === "overdue" ? (
          <Pill tone="red" label="Time overdue">
            Overdue by {formatCountdown(timing.msOverdue)}
          </Pill>
        ) : null}
      </div>
      {m.invitees && m.invitees.length > 0 ? (
        <div className={styles.invitees}>
          <p className={styles.inviteesTitle}>Selected to attend</p>
          <ul className={styles.inviteeList}>
            {m.invitees.map((inv) => (
              <li key={inv.id}>
                {inv.fullName}
                <span className={styles.inviteeRole}>
                  {" "}
                  · {friendlyWords(inv.role)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.meetingActions}>
        <Button
          variant="outline"
          className={`${styles.logBtn} h-6`}
          onClick={() => outcome.setLogOpen(true)}
        >
          See attendance log
        </Button>
      </div>
      <AttendanceLogModal
        meeting={m}
        timing={timing}
        showOutcomeRecords={showOutcomeRecords}
        needsOutcome={needsOutcome}
        images={outcome.images}
        open={outcome.logOpen}
        onClose={() => outcome.setLogOpen(false)}
        pending={outcome.pending}
        onYes={() => {
          outcome.setLogOpen(false);
          outcome.openYesDialog();
        }}
        onNo={() => {
          outcome.setLogOpen(false);
          outcome.openAskDialog();
        }}
      />
      <OutcomeDialog meeting={m} timing={timing} outcome={outcome} />
    </li>
  );
}
