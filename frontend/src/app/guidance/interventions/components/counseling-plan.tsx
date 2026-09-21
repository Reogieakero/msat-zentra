"use client";

import * as React from "react";
import { Calendar, Clock, MapPin } from "lucide-react";
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
import { InterventionSessionDocsDialog } from "./InterventionSessionDocsDialog";
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

/* "1d 2h 3m 4s" — days, hours, minutes, seconds for the live countdown. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
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
  onDocsChanged: () => void;
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
  onDocsChanged,
}: CounselingPlanProps) {
  const expanded = !collapsed;
  const upcoming =
    followUp.sessions.find((s) => s.status === "scheduled") ?? null;
  const [docsFor, setDocsFor] = React.useState<CounselingSessionItem | null>(null);

  // Live per-second clock, ticking only while an upcoming session is on the
  // plan so the countdown stays exact without burning renders otherwise.
  const hasUpcoming = followUp.sessions.some((s) => s.status === "scheduled");
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!hasUpcoming) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasUpcoming]);

  return (
    <div className={styles.plan}>
      <div className={styles.planHead}>
        <p className={styles.blockLabel}>Counseling plan</p>
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
          {followUp.sessions.map((s) => {
            const target = new Date(s.scheduledAt).getTime();
            const started =
              s.status === "completed" ||
              (Number.isFinite(target) && target <= now);
            // Documentary unlocks on finished sessions (even on closed
            // follow-ups, so late evidence can still be filed) and on booked
            // sessions once their time arrives (server enforces this too).
            const docsUnlocked =
              s.status === "completed" ||
              (workable && s.status === "scheduled" && started);
            return (
              <li key={s.id} className={styles.session}>
                <div className={styles.sessionTop}>
                  <span className={styles.srOnly}>
                    Status:{" "}
                    {s.status === "completed"
                      ? "Done"
                      : s.status === "cancelled"
                        ? "Cancelled"
                        : "Upcoming"}
                  </span>
                  <p className={styles.topCountdown} aria-live="off">
                    {s.status === "scheduled" && Number.isFinite(target)
                      ? target > now
                        ? `Starts in ${formatCountdown(target - now)}`
                        : "Starting now"
                      : null}
                  </p>
                </div>
                <div className={styles.sessionFacts}>
                  <p
                    className={`${styles.watermark} ${
                      s.status === "completed"
                        ? styles.watermarkDone
                        : s.status === "cancelled"
                          ? styles.watermarkCancelled
                          : styles.watermarkUpcoming
                    }`}
                    aria-hidden="true"
                  >
                    {s.status === "completed"
                      ? "Done"
                      : s.status === "cancelled"
                        ? "Cancelled"
                        : "Upcoming"}
                  </p>
                  <p className={styles.sessionTitle}>
                    <span className={styles.titleLabel}>Session kind:</span>
                    {sessionTypeLabel(s.sessionType)}
                  </p>
                  <p className={styles.factRow}>
                    <Calendar className={styles.factIcon} aria-hidden />
                    <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                  </p>
                  <p className={styles.factRow}>
                    <Clock className={styles.factIcon} aria-hidden />
                    {formatTime(s.scheduledAt)}
                  </p>
                  {s.venue ? (
                    <p className={styles.factRow}>
                      <MapPin className={styles.factIcon} aria-hidden />
                      {s.venue}
                    </p>
                  ) : null}
                </div>
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
                {docsUnlocked && (
                  <div className={styles.sessionActions}>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={locked || isActionPending}
                      onClick={() => setDocsFor(s)}
                    >
                      {(s.attachmentsCount ?? 0) > 0 ? "See attached images" : "Add docs"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {followUp.sessions.length > 0 && (
        <div className={styles.planFooter}>
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
          {/* No upcoming session (e.g. the booking was cancelled) — booking
              stays available so the case can move again. */}
          {!upcoming && workable && (
            <Button
              type="button"
              size="xs"
              disabled={locked || isActionPending}
              onClick={onSchedule}
            >
              Book session
            </Button>
          )}
          {upcoming && workable && (
            <div className={styles.sessionActions}>
              <Button
                type="button"
                size="xs"
                disabled={
                  locked ||
                  isActionPending ||
                  new Date(upcoming.scheduledAt).getTime() > now
                }
                title={
                  new Date(upcoming.scheduledAt).getTime() > now
                    ? "You can mark it done once the scheduled time arrives"
                    : undefined
                }
                onClick={() => onSession(upcoming, "finish")}
              >
                <Busy busy={isBusy("finish")} />
                Mark done
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={() => onSession(upcoming, "move")}
              >
                Reschedule session
              </Button>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                className={styles.btnRed}
                disabled={locked || isActionPending}
                onClick={() => onSession(upcoming, "cancelSess")}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
      {docsFor && (
        <InterventionSessionDocsDialog
          followUpId={followUp.id}
          session={docsFor}
          open
          onClose={() => setDocsFor(null)}
          onChanged={onDocsChanged}
        />
      )}
    </div>
  );
}
