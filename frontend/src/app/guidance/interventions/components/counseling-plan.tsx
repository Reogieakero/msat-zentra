"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatTime,
  sessionTypeLabel,
} from "../../referrals/components/guidance-referrals-table";
import type {
  CounselingSessionItem,
  StudentFollowUp,
} from "./guidance-interventions-data";
import { Busy } from "./busy";
import styles from "./counseling-plan.module.css";

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

interface CounselingPlanProps {
  followUp: StudentFollowUp;
  studentFirstName: string;
  workable: boolean;
  closed: boolean;
  rejected: boolean;
  collapsed: boolean;
  onToggle: () => void;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
}

export function CounselingPlan({
  followUp,
  studentFirstName,
  workable,
  closed,
  rejected,
  collapsed,
  onToggle,
  locked,
  isActionPending,
  isBusy,
  onSchedule,
  onSession,
}: CounselingPlanProps) {
  const expanded = !collapsed;

  return (
    <div className={styles.plan}>
      <div className={styles.planHead}>
        <p className={styles.blockLabel}>Counseling plan</p>
        <div className={styles.planButtons}>
          {followUp.sessions.length > 0 && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={onToggle}
              aria-expanded={expanded}
            >
              {expanded
                ? "Hide sessions"
                : `Show sessions (${followUp.sessions.length})`}
            </Button>
          )}
          {workable && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={locked || isActionPending}
              onClick={onSchedule}
            >
              Schedule a session
            </Button>
          )}
        </div>
      </div>
      {closed || rejected ? (
        <p className={styles.planEmpty}>
          {closed
            ? "This follow-up is closed — the sessions below are kept as history."
            : "This plan was rejected — record the outcome to close it."}
        </p>
      ) : null}
      {followUp.sessions.length === 0 ? (
        <p className={styles.planEmpty}>
          No sessions yet — schedule the first talk with {studentFirstName}.
        </p>
      ) : !expanded ? (
        <p className={styles.planEmpty}>
          {followUp.completedSessions} of {followUp.sessions.length} finished —
          show the sessions to see details.
        </p>
      ) : (
        <ul className={styles.sessionList}>
          {followUp.sessions.map((s) => (
            <li key={s.id} className={styles.session}>
              <div className={styles.sessionTop}>
                <Badge
                  variant={
                    s.status === "completed"
                      ? "success"
                      : s.status === "cancelled"
                        ? "secondary"
                        : "default"
                  }
                >
                  {s.status === "completed"
                    ? "Done"
                    : s.status === "cancelled"
                      ? "Cancelled"
                      : "Upcoming"}
                </Badge>
                <p className={styles.sessionTitle}>
                  {sessionTypeLabel(s.sessionType)}
                </p>
              </div>
              <ul className={styles.sessionFacts}>
                <li>
                  <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                </li>
                <li>{formatTime(s.scheduledAt)}</li>
                {s.venue ? <li>{s.venue}</li> : null}
              </ul>
              {s.status === "completed" && s.sessionNotes ? (
                <p className={styles.sessionNotes}>{s.sessionNotes}</p>
              ) : null}
              {s.status === "completed" && s.outcome ? (
                <p className={styles.sessionOutcome}>
                  <span className={styles.calloutPrefix}>Outcome: </span>
                  {s.outcome}
                </p>
              ) : null}
              {s.status === "cancelled" && s.cancelReason ? (
                <p className={styles.sessionOutcome}>{s.cancelReason}</p>
              ) : null}
              {s.status === "scheduled" && workable && (
                <div className={styles.sessionActions}>
                  <Button
                    type="button"
                    size="xs"
                    disabled={locked || isActionPending}
                    onClick={() => onSession(s, "finish")}
                  >
                    <Busy busy={isBusy("finish")} />
                    Mark done
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={locked || isActionPending}
                    onClick={() => onSession(s, "move")}
                  >
                    Move
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={locked || isActionPending}
                    onClick={() => onSession(s, "cancelSess")}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
