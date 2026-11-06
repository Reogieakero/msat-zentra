"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar, CalendarCheck, Check, Clock, MapPin, User, X } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill, type PillTone } from "@/components/ui/pill";
import { formatTime } from "../../referrals/components/guidance-referrals-format";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import board from "@/components/session-booking/BookSessionDialog.board.module.css";

function fmtDate(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDay(value: string, nowMs: number): "Today" | "Tomorrow" | null {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date(nowMs);
  if (d.toDateString() === now.toDateString()) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString() ? "Tomorrow" : null;
}

type SessionState = "done" | "cancelled" | "ongoing" | "upcoming";

function stateOf(status: string, scheduledAt: string): SessionState {
  if (status === "completed") return "done";
  if (status === "cancelled") return "cancelled";
  const target = new Date(scheduledAt).getTime();
  return Number.isFinite(target) && target <= Date.now() ? "ongoing" : "upcoming";
}

const STATE_LABEL: Record<SessionState, string> = {
  done: "Done",
  cancelled: "Cancelled",
  ongoing: "Ongoing",
  upcoming: "Upcoming",
};

const STATE_TONE: Record<SessionState, PillTone> = {
  done: "green",
  cancelled: "neutral",
  ongoing: "amber",
  upcoming: "blue",
};

/**
 * Booked-session overlay — the alerts board's wide kanban surface showing
 * every session on a case. Opened from the calendar icon on a case card.
 */
export function SessionListDialog({
  row,
  followUp,
  open,
  onClose,
  now,
}: {
  row: AtRiskStudentItem;
  followUp: AtRiskStudentItem["intervention"];
  open: boolean;
  onClose: () => void;
  now: number;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sessions = [...(followUp?.sessions ?? [])].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return createPortal(
    <div
      className={board.overlay}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Booked sessions for ${row.student}`}
        className={board.shell}
      >
        <div className={board.header}>
          <span className={board.headIcon} aria-hidden="true">
            <CalendarCheck size={16} />
          </span>
          <div className={board.headText}>
            <h2 className={board.title}>Booked sessions</h2>
            <p className={board.description}>
              Counseling sessions for {row.student}.
            </p>
          </div>
          <button
            type="button"
            className={board.close}
            onClick={onClose}
            aria-label="Close booked sessions"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={board.scroll}>
          <div className={board.caseStrip}>
            <StudentMascot name={row.student} seed={row.lrn} size={36} />
            <div className={board.caseText}>
              <span className={board.caseName}>{row.student}</span>
              <div className={board.casePills}>
                {row.lrn ? (
                  <Pill label="LRN" className="tabular-nums">
                    {row.lrn}
                  </Pill>
                ) : null}
                {row.section ? (
                  <Pill tone="amber" label="Section">
                    {row.section}
                  </Pill>
                ) : null}
              </div>
            </div>
          </div>

          <div className={board.lane}>
            <div className={board.laneHead}>
              <span className={board.laneTitle}>
                <CalendarCheck className={`${board.laneIcon} ${board.iconSchedule}`} aria-hidden />
                Sessions
              </span>
              <span className={board.laneHint}>
                {sessions.length} on record
              </span>
            </div>
            <div className={board.laneCards}>
              {sessions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
                  No sessions booked yet.
                </p>
              ) : (
                sessions.map((s) => {
                  const state = stateOf(s.status, s.scheduledAt);
                  const rel = relativeDay(s.scheduledAt, now);
                  return (
                    <article
                      key={s.id}
                      className="overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <User className="size-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {sessionTypeLabel(s.sessionType)}
                            </p>
                            {rel ? (
                              <span className="rounded-md bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                                {rel}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" aria-hidden />
                              <time dateTime={s.scheduledAt}>{fmtDate(s.scheduledAt)}</time>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" aria-hidden />
                              {formatTime(s.scheduledAt)}
                            </span>
                            {s.venue ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" aria-hidden />
                                {s.venue}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <Pill tone={STATE_TONE[state]} label="Session status">
                          {state === "done" ? (
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          ) : null}
                          {STATE_LABEL[state]}
                        </Pill>
                      </div>
                      {(s.status === "completed" && (s.sessionNotes || s.outcome)) ||
                      (s.status === "cancelled" && s.cancelReason) ? (
                        <dl className="grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-border/70 bg-muted/40 px-3 py-2.5 text-xs">
                          {s.status === "completed" && s.sessionNotes ? (
                            <>
                              <dt className="text-muted-foreground">Notes</dt>
                              <dd className="text-foreground">{s.sessionNotes}</dd>
                            </>
                          ) : null}
                          {s.status === "completed" && s.outcome ? (
                            <>
                              <dt className="text-muted-foreground">Outcome</dt>
                              <dd className="text-foreground">{s.outcome}</dd>
                            </>
                          ) : null}
                          {s.status === "cancelled" && s.cancelReason ? (
                            <>
                              <dt className="text-muted-foreground">Reason</dt>
                              <dd className="text-foreground">{s.cancelReason}</dd>
                            </>
                          ) : null}
                        </dl>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
