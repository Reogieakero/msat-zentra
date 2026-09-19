"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import styles from "./session-plan-card.module.css";

/* One session row on the shared card — structural fields only, so both
   desks map their own session items onto it. */
export interface PlanSessionItem {
  id: string;
  sessionType: string;
  scheduledAt: string;
  date: string;
  venue: string;
  status: string;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
  attachmentsCount?: number;
}

export type PlanSessionAction = "docs" | "finish" | "move" | "cancel" | "delete";

/* "2026-09-12" -> "Sep 12, 2026". */
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

/* "2026-09-20T06:30:00.000Z" -> "2:30 PM" (reader's timezone). */
function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* "1d 04:03:22" / "04:03:22" — always with seconds, tabular-nums. */
function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function nextScheduled(sessions: PlanSessionItem[]): PlanSessionItem | null {
  const actives = sessions
    .filter((s) => s.status === "scheduled")
    .slice()
    .sort((a, b) => {
      const at = new Date(a.scheduledAt).getTime();
      const bt = new Date(b.scheduledAt).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return at - bt;
    });
  return actives[0] ?? null;
}

/**
 * Shared sessions card — Clinic sessions on the nurse desk, Counseling
 * plan on the guidance desk. Nurse card design: header with the live
 * countdown on the right; each row shows the status badge first
 * (Upcoming / Done / Cancelled), then the live timer, then the title.
 * Docs UI renders only with docsSupported; Mark done / docs stay locked
 * until start time only with gateOnStart.
 */
export function SessionPlanCard<T extends PlanSessionItem>({
  title,
  sessions,
  now,
  closed,
  closedHint,
  emptyHint,
  kindLabel,
  docsSupported = false,
  gateOnStart = false,
  manageable,
  disabled = false,
  onAction,
}: {
  title: string;
  sessions: T[];
  now: number;
  closed: boolean;
  closedHint: string;
  emptyHint: React.ReactNode;
  kindLabel: (sessionType: string) => string;
  docsSupported?: boolean;
  gateOnStart?: boolean;
  manageable: boolean;
  disabled?: boolean;
  onAction: (session: T, action: PlanSessionAction) => void;
}) {
  return (
    <div className={styles.plan}>
      <div className={styles.planHead}>
        <p className={styles.blockLabel}>{title}</p>
      </div>
      {closed ? (
        <p className={styles.planEmpty}>{closedHint}</p>
      ) : null}
      {sessions.length === 0 ? (
        <p className={styles.planEmpty}>{emptyHint}</p>
      ) : (
        <ul className={styles.sessionList}>
          {sessions.map((s) => {
            const isScheduled = s.status === "scheduled";
            const targetMs = new Date(s.scheduledAt).getTime();
            const started = Number.isFinite(targetMs) && targetMs <= now;
            const locked = gateOnStart && isScheduled && !started;
            const showActions =
              manageable && s.status !== "cancelled" && (docsSupported || isScheduled);
            return (
              <li key={s.id} className={styles.session}>
                <div className={styles.sessionTop}>
                  <p className={styles.sessionTitle}>
                    {kindLabel(s.sessionType)}
                  </p>
                  <span className={styles.sessionTopRight}>
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
                    {isScheduled && Number.isFinite(targetMs) ? (
                      <span
                        className={styles.countdown}
                        role="timer"
                        aria-live="off"
                        aria-label={
                          started
                            ? "Session time arrived"
                            : `Session starts in ${formatCountdown(targetMs, now)}`
                        }
                      >
                        <span className={styles.countdownDot} aria-hidden="true" />
                        {started ? <>Ongoing</> : <>{formatCountdown(targetMs, now)}</>}
                      </span>
                    ) : null}
                  </span>
                </div>
                <ul className={styles.sessionFacts}>
                  <li>
                    <time dateTime={s.scheduledAt}>
                      {formatDate(s.date)}
                    </time>
                  </li>
                  <li>{formatTime(s.scheduledAt)}</li>
                  {s.venue ? <li>{s.venue}</li> : null}
                </ul>
                {locked ? (
                  <p className={styles.sessionCountdown}>
                    Mark done{docsSupported ? " and docs" : ""} unlock at session time.
                  </p>
                ) : null}
                {s.status === "completed" && s.sessionNotes ? (
                  <p className={styles.sessionNotes}>
                    {s.sessionNotes}
                  </p>
                ) : null}
                {s.status === "completed" && s.outcome ? (
                  <p className={styles.sessionOutcome}>
                    <span className={styles.calloutPrefix}>
                      Outcome:{" "}
                    </span>
                    {s.outcome}
                  </p>
                ) : null}
                {s.status === "cancelled" && s.cancelReason ? (
                  <p className={styles.sessionOutcome}>
                    {s.cancelReason}
                  </p>
                ) : null}
                {docsSupported && (s.attachmentsCount ?? 0) > 0 ? (
                  <p className={styles.sessionOutcome}>
                    <span className={styles.calloutPrefix}>
                      Docs:{" "}
                    </span>
                    {s.attachmentsCount} photo{s.attachmentsCount === 1 ? "" : "s"} filed
                    {" — "}
                    <button
                      type="button"
                      className={styles.folderBtn}
                      onClick={() => onAction(s, "docs")}
                      aria-label={`View documentation for the ${formatDate(s.date)} session`}
                    >
                      view
                    </button>
                  </p>
                ) : null}
                {showActions ? (
                  <div
                    className={styles.sessionActions}
                    style={{ justifyContent: "flex-end", alignItems: "center" }}
                  >
                    {docsSupported ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                            style={{ height: "32px" }}
                            disabled={disabled || locked}
                            title={
                              locked
                                ? "Documentation unlocks once the session time arrives"
                            : s.status === "completed"
                              ? "View or file documentation for this session"
                              : "File documentation for this session"
                        }
                        onClick={() => onAction(s, "docs")}
                      >
                        {(s.attachmentsCount ?? 0) > 0 ? "Docs" : "Add docs (optional)"}
                      </Button>
                    ) : null}
                    {isScheduled ? (
                      <span style={{ display: "inline-flex", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button
                          type="button"
                          size="xs"
                          style={{ height: "32px" }}
                          disabled={disabled || locked}
                          title={
                            locked
                              ? "You can mark this session done once the scheduled time arrives"
                              : "Record what happened and mark this session done"
                          }
                          onClick={() => onAction(s, "finish")}
                        >
                          Mark done
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          style={{ height: "32px" }}
                          disabled={disabled}
                          onClick={() => onAction(s, "move")}
                        >
                          Move
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          style={{ height: "32px", backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                          disabled={disabled}
                          onClick={() => onAction(s, "cancel")}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {manageable && s.status === "cancelled" ? (
                  <div
                    className={styles.sessionActions}
                    style={{ justifyContent: "flex-end", alignItems: "center" }}
                  >
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      className={styles.deleteBtn}
                      style={{ height: "32px", backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff", opacity: 1 }}
                      title="Permanently remove this cancelled session"
                      disabled={disabled}
                      onClick={() => onAction(s, "delete")}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
