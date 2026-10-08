"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, FileText, MoreHorizontal, Move as MoveIcon } from "lucide-react";
import styles from "./session-plan-card.module.css";

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

function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

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

                    {isScheduled && started ? null : (
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
                    )}
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

                {showActions || (manageable && s.status === "cancelled") ? (
                  <div
                    className={styles.sessionActions}
                    style={{ justifyContent: "flex-end", alignItems: "center" }}
                  >
                    {s.status === "cancelled" ? (
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
                    ) : isScheduled ? (
                      <>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={disabled}
                              aria-label={`More actions for the ${formatDate(s.date)} session`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="z-[60] min-w-44"
                          >
                            <DropdownMenuItem
                              disabled={disabled || locked}
                              title={
                                locked
                                  ? "You can mark this session done once the scheduled time arrives"
                                  : "Record what happened and mark this session done"
                              }
                              onSelect={() => onAction(s, "finish")}
                            >
                              <Check />
                              Mark done
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={disabled}
                              onSelect={() => onAction(s, "move")}
                            >
                              <MoveIcon />
                              Move
                            </DropdownMenuItem>
                            {docsSupported ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={disabled || locked}
                                  title={
                                    locked
                                      ? "Documentation unlocks once the session time arrives"
                                      : s.status === "completed"
                                        ? "View or file documentation for this session"
                                        : "File documentation for this session"
                                  }
                                  onSelect={() => onAction(s, "docs")}
                                >
                                  <FileText />
                                  {(s.attachmentsCount ?? 0) > 0 ? "Docs" : "Add docs (optional)"}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : docsSupported ? (
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
