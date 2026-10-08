"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { venueLabel } from "@/services/coordinator/labels";
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
        display: active ? undefined : "none",
      }}
      aria-hidden={active ? undefined : true}
    >
      <div className={styles.badgeRow} style={{ marginTop: 0 }}>
        <Badge variant={m.venue === "home" ? "secondary" : "outline"}>
          {venueLabel(m.venue)}
        </Badge>
        <Badge variant={m.attended ? "success" : "outline"}>
          {m.attended ? "Attended" : "Booked"}
        </Badge>
        {showCountdown && timing.state === "upcoming" ? (
          <Badge variant="outline">
            Starts in {formatCountdown(timing.msUntil)}
          </Badge>
        ) : null}
        {timing.state === "live" ? (
          <Badge variant="success">Live now</Badge>
        ) : null}
        {showCountdown && timing.state === "overdue" ? (
          <Badge variant="destructive">
            Overdue by {formatCountdown(timing.msOverdue)}
          </Badge>
        ) : null}
      </div>
      <div className={styles.attendBtns} style={{ marginTop: "0.625rem" }}>
        <Button
          variant="outline"
          className={styles.logBtn}
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
