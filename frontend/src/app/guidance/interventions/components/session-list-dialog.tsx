"use client";
import { Calendar, CalendarCheck, Check, Clock, History, User } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import { formatTime } from "../../referrals/components/guidance-referrals-format";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";

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

export function SessionListDialog({
  row,
  followUp,
  sessionsOpen,
  historyOpen,
  onSessionsOpenChange,
  onHistoryOpenChange,
  now,
}: {
  row: AtRiskStudentItem;
  followUp: AtRiskStudentItem["intervention"];
  sessionsOpen: boolean;
  historyOpen: boolean;
  onSessionsOpenChange: (open: boolean) => void;
  onHistoryOpenChange: (open: boolean) => void;
  now: number;
}) {
  const sessions = followUp?.sessions ?? [];
  return (
    <>
      <CardModal
        open={sessionsOpen}
        onClose={() => onSessionsOpenChange(false)}
        size="md"
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <CalendarCheck className="size-5" aria-hidden />
            </span>
            Booked sessions
          </span>
        }
        description={
          <>
            Counseling sessions for <strong className="font-medium text-slate-900 dark:text-slate-100">{row.student}</strong>.
          </>
        }
        watchKey={`${sessions.length}`}
      >
        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No booked sessions.
            </p>
          )}
          {sessions.map((s) => {
            const rel = relativeDay(s.scheduledAt, now);
            return (
              <article
                key={s.id}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 px-4 py-3.5 dark:border-white/10"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  <User className="size-[18px]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold leading-5 dark:text-slate-100">
                      {sessionTypeLabel(s.sessionType)}
                    </h3>
                    {rel && (
                      <span className="rounded-md bg-slate-100 px-2 py-px text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {rel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-3.5 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" aria-hidden />
                      {fmtDate(s.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden />
                      {formatTime(s.scheduledAt)}
                    </span>
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
                  Upcoming
                </span>
              </article>
            );
          })}
        </div>
      </CardModal>

      <CardModal
        open={historyOpen}
        onClose={() => onHistoryOpenChange(false)}
        size="md"
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <History className="size-5" aria-hidden />
            </span>
            Session history
          </span>
        }
        description={
          <>
            Every session on <strong className="font-medium text-slate-900 dark:text-slate-100">{row.student}</strong>
            ’s closed follow-up.
          </>
        }
        watchKey={`${sessions.length}`}
      >
        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No sessions yet.
            </p>
          )}
          {sessions.map((s) => (
            <article
              key={s.id}
              className="overflow-hidden rounded-[14px] border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  <User className="size-[18px]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold leading-5 dark:text-slate-100">
                    {sessionTypeLabel(s.sessionType)}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-3.5 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" aria-hidden />
                      {fmtDate(s.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden />
                      {formatTime(s.scheduledAt)}
                    </span>
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-green-800 dark:bg-green-500/20 dark:text-green-200">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                  Done
                </span>
              </div>
              {(s.sessionNotes || s.outcome) && (
                <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-5 dark:border-white/10 dark:bg-white/5">
                  {s.sessionNotes && (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Notes</dt>
                      <dd className="text-slate-900 dark:text-slate-100">{s.sessionNotes}</dd>
                    </>
                  )}
                  {s.outcome && (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Outcome</dt>
                      <dd className="text-slate-900 dark:text-slate-100">{s.outcome}</dd>
                    </>
                  )}
                </dl>
              )}
            </article>
          ))}
        </div>
      </CardModal>
    </>
  );
}
