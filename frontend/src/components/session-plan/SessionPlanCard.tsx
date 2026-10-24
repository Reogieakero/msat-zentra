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
  User,
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

/**
 * Dialog width that fits the session board — one column per session, three at
 * most before the boards start to squeeze. Keeps the 2rem viewport margins of
 * the dialog's base max-width at every breakpoint.
 */
export function sessionBoardDialogWidth(count: number): string {
  if (count >= 3) return "sm:max-w-[min(56rem,calc(100%-2rem))]";
  if (count === 2) return "sm:max-w-[min(42rem,calc(100%-2rem))]";
  return "sm:max-w-md";
}

/**
 * Sessions render as kanban-board cards — the same anatomy as the floating
 * boards on the desks (icon + muted title header with a divider, status pill
 * on the right) laid out in a board grid, one board per session.
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
    <div className="flex flex-col gap-3">
      <span className="sr-only">{title}</span>
      {closed ? (
        <p className="text-sm leading-6 text-muted-foreground">{closedHint}</p>
      ) : null}
      {sessions.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 p-0">
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
              /* Board card — the session sits inside the desk's kanban board
                 frame (added by the caller), so it only needs the compact
                 card anatomy: kind + status on top, facts, countdown, actions. */
              <li
                key={s.id}
                className="flex min-w-0 flex-col gap-2.5 rounded-md border border-border bg-card p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                    <User className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{kindLabel(s.sessionType)}</span>
                  </span>
                  <StatusPill status={s.status} started={started} />
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                    {/* Facts */}
                    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" aria-hidden="true" />
                        <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatTime(s.scheduledAt)}
                      </span>
                    </p>

                    {/* Live countdown strip for upcoming sessions */}
                    {isScheduled && hasTarget ? (
                      <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2">
                        <p className="m-0 flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {started ? "Session time" : "Starts in"}
                          </span>
                          <span
                            role="timer"
                            aria-label={
                              started
                                ? "Session time arrived"
                                : `Session starts in ${formatCountdown(targetMs, now)}`
                            }
                            className="text-base font-semibold leading-tight tabular-nums text-foreground"
                          >
                            {started ? "Now" : formatCountdown(targetMs, now)}
                          </span>
                        </p>
                        <p className="m-0 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
                          {started ? (
                            <LockOpen className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                          )}
                          {started
                            ? "You can now mark this session done and add docs."
                            : `Mark done${docsSupported ? " and docs" : ""} unlock at session time.`}
                        </p>
                      </div>
                    ) : null}

                    {/* Notes / outcome / cancel reason / docs count */}
                    {s.status === "completed" && s.sessionNotes ? (
                      <p className="m-0 text-[13px] leading-5 whitespace-pre-wrap text-foreground">
                        {s.sessionNotes}
                      </p>
                    ) : null}
                    {s.status === "completed" && s.outcome ? (
                      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
                        <span className="font-semibold text-foreground">Outcome: </span>
                        {s.outcome}
                      </p>
                    ) : null}
                    {s.status === "cancelled" && s.cancelReason ? (
                      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
                        {s.cancelReason}
                      </p>
                    ) : null}
                    {docsSupported && (s.attachmentsCount ?? 0) > 0 ? (
                      <p className="m-0 text-[12px] leading-4 text-muted-foreground">
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
                        <div className="mt-auto flex items-center justify-end gap-1.5 pt-0.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            className={`${styles.deleteBtn} h-6 rounded-md px-3 text-xs`}
                            title="Permanently remove this cancelled session"
                            disabled={disabled}
                            onClick={() => onAction(s, "delete")}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : null
                    ) : showActions ? (
                      <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
                        {isScheduled ? (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-6 rounded-md"
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
                                  className={`${styles.cancelItem} font-medium`}
                                  onSelect={() => onAction(s, "cancel")}
                                >
                                  Cancel session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="h-6 rounded-md px-2.5 text-xs"
                              disabled={disabled}
                              onClick={() => onAction(s, "move")}
                            >
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
                                  ? "h-6 rounded-md bg-muted px-2.5 text-xs text-muted-foreground"
                                  : "h-6 rounded-md bg-[#2563eb] px-2.5 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                              }
                            >
                              Mark done
                            </Button>
                          </>
                        ) : docsSupported ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="h-6 rounded-md px-2.5 text-xs"
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
                  </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
