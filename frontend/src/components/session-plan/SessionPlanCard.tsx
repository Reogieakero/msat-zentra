"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Check,
  Clock,
  FileText,
  Lock,
  LockOpen,
  MoreHorizontal,
  Move as MoveIcon,
  User,
  XCircle,
} from "lucide-react";
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
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function StatusPill({ status, started }: { status: string; started: boolean }) {
  if (status === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 dark:border-[#1c5a37] dark:bg-[#0f2a1c] dark:text-[#86efac]">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        Done
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Cancelled
      </span>
    );
  }
  if (started) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 dark:border-[#1c5a37] dark:bg-[#0f2a1c] dark:text-[#86efac]">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        Ready to record
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:border-[#1e3a6e] dark:bg-[#0f1a33] dark:text-[#bfdbfe]">
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      Upcoming
    </span>
  );
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
    <div className="flex flex-col gap-3">
      <span className="sr-only">{title}</span>
      {closed ? (
        <p className="text-sm leading-6 text-muted-foreground">{closedHint}</p>
      ) : null}
      {sessions.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sessions.map((s) => {
            const isScheduled = s.status === "scheduled";
            const targetMs = new Date(s.scheduledAt).getTime();
            const hasTarget = Number.isFinite(targetMs);
            const started = hasTarget && targetMs <= now;
            const locked = gateOnStart && isScheduled && !started;
            const showActions =
              manageable && s.status !== "cancelled" && (docsSupported || isScheduled);
            const docsLabel =
              (s.attachmentsCount ?? 0) > 0 ? "Docs" : "Add docs (optional)";
            return (
              <li
                key={s.id}
                className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-card p-4"
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <User className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[15px] font-semibold leading-5 text-foreground">
                      {kindLabel(s.sessionType)}
                    </p>
                    <p className="mt-1 flex items-center gap-4 text-[13px] leading-[18px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" aria-hidden="true" />
                        <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatTime(s.scheduledAt)}
                      </span>
                    </p>
                  </div>
                  <StatusPill status={s.status} started={started} />
                </div>

                {/* Status strip for upcoming sessions */}
                {isScheduled && hasTarget ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="m-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {started ? "Session time" : "Starts in"}
                      </p>
                      <p
                        role="timer"
                        aria-label={
                          started
                            ? "Session time arrived"
                            : `Session starts in ${formatCountdown(targetMs, now)}`
                        }
                        className="m-0 text-2xl font-semibold tabular-nums text-foreground"
                      >
                        {started ? "Now" : formatCountdown(targetMs, now)}
                      </p>
                    </div>
                    <p className="m-0 flex max-w-[250px] items-start gap-2 text-[13px] leading-5 text-muted-foreground">
                      {started ? (
                        <LockOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      )}
                      {started
                        ? "You can now mark this session done and add docs."
                        : `Mark done${docsSupported ? " and docs" : ""} unlock at session time.`}
                    </p>
                  </div>
                ) : null}

                {/* Notes / outcome / cancel reason / docs count */}
                {s.status === "completed" && s.sessionNotes ? (
                  <p className="m-0 text-sm leading-6 whitespace-pre-wrap text-foreground">
                    {s.sessionNotes}
                  </p>
                ) : null}
                {s.status === "completed" && s.outcome ? (
                  <p className="m-0 text-sm leading-6 text-muted-foreground">
                    <span className="font-semibold text-foreground">Outcome: </span>
                    {s.outcome}
                  </p>
                ) : null}
                {s.status === "cancelled" && s.cancelReason ? (
                  <p className="m-0 text-sm leading-6 text-muted-foreground">
                    {s.cancelReason}
                  </p>
                ) : null}
                {docsSupported && (s.attachmentsCount ?? 0) > 0 ? (
                  <p className="m-0 text-sm leading-6 text-muted-foreground">
                    <span className="font-semibold text-foreground">Docs: </span>
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

                {/* Actions */}
                {s.status === "cancelled" ? (
                  manageable ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        className={`${styles.deleteBtn} h-8 rounded-[8px] px-4`}
                        title="Permanently remove this cancelled session"
                        disabled={disabled}
                        onClick={() => onAction(s, "delete")}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null
                ) : showActions ? (
                  <div className="flex items-center justify-end gap-2">
                    {isScheduled ? (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-8 rounded-[8px]"
                              disabled={disabled}
                              aria-label={`More actions for the ${formatDate(s.date)} session`}
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="z-[60] w-[250px] rounded-xl p-1.5"
                          >
                            {docsSupported ? (
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
                                <FileText aria-hidden="true" />
                                {docsLabel}
                                {locked ? (
                                  <Lock
                                    className="ml-auto size-3.5"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </DropdownMenuItem>
                            ) : null}
                            {docsSupported ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={disabled}
                              className="text-[#b91c1c] dark:text-[#fca5a5]"
                              onSelect={() => onAction(s, "cancel")}
                            >
                              <XCircle aria-hidden="true" />
                              Cancel session
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="h-8 rounded-[8px] px-4 text-sm"
                          disabled={disabled}
                          onClick={() => onAction(s, "move")}
                        >
                          <MoveIcon aria-hidden="true" />
                          Move
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          disabled={disabled || locked}
                          title={
                            locked
                              ? "You can mark this session done once the scheduled time arrives"
                              : "Record what happened and mark this session done"
                          }
                          onClick={() => onAction(s, "finish")}
                          className={
                            locked
                              ? "h-8 rounded-[8px] bg-muted px-4 text-sm text-muted-foreground"
                              : "h-8 rounded-[8px] bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                          }
                        >
                          {locked ? (
                            <Lock aria-hidden="true" />
                          ) : (
                            <Check strokeWidth={3} aria-hidden="true" />
                          )}
                          Mark done
                        </Button>
                      </>
                    ) : docsSupported ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-8 rounded-[8px] px-4"
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
                        {docsLabel}
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
