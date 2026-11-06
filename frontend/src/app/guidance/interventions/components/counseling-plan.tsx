"use client";

import * as React from "react";
import { Calendar, Check, ChevronDown, Clock, ImageIcon, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/labels/datetime";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type {
  CounselingSessionItem,
  StudentFollowUp,
} from "@/services/guidance/interventions.types";
import { Busy } from "./busy";
import { InterventionSessionDocsDialog } from "./InterventionSessionDocsDialog";

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

export type LiveSessionState = "completed" | "cancelled" | "ongoing" | "upcoming";

export function liveSessionState(
  status: string,
  scheduledAt: string,
  now: number
): LiveSessionState {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  const target = new Date(scheduledAt).getTime();
  if (Number.isFinite(target) && target <= now) return "ongoing";
  return "upcoming";
}

export function liveSessionLabel(state: LiveSessionState): string {
  switch (state) {
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "ongoing":
      return "Ongoing";
    default:
      return "Upcoming";
  }
}

function StatusPill({ live }: { live: LiveSessionState }) {
  if (live === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-green-800 dark:bg-green-500/20 dark:text-green-200">
        <Check className="size-3" strokeWidth={3} aria-hidden />
        Done
      </span>
    );
  }
  if (live === "ongoing") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
        <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden />
        Ongoing
      </span>
    );
  }
  if (live === "cancelled") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-100 py-[3px] pl-2 pr-2.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
      <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
      Upcoming
    </span>
  );
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

  const hasUpcoming = followUp.sessions.some((s) => s.status === "scheduled");
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!hasUpcoming) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasUpcoming]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-5 dark:text-slate-100">Counseling plan</h3>
          {closed || rejected ? (
            <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
              {closed
                ? "This follow-up is closed — the sessions below are kept as history."
                : "This plan was rejected — record the outcome to close it."}
            </p>
          ) : null}
        </div>
        {followUp.sessions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            aria-controls="case-sessions"
            onClick={onToggle}
            className="h-8 shrink-0 gap-1.5 rounded-lg border-slate-200 px-3 text-[13px] font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
          >
            {expanded ? "Hide sessions" : `Show sessions (${followUp.sessions.length})`}
            <ChevronDown
              className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </Button>
        )}
      </div>

      <div id="case-sessions" className="mt-3 space-y-3">
        {followUp.sessions.length === 0 ? (
          <p className="rounded-[14px] border border-slate-200 px-4 py-3.5 text-[13px] text-slate-500 dark:border-white/10 dark:text-slate-400">
            No sessions yet — schedule the first talk with {studentFirstName}.
          </p>
        ) : !expanded ? (
          <div className="rounded-[14px] border border-dashed border-slate-300 px-4 py-3.5 text-[13px] text-slate-500 dark:border-white/20 dark:text-slate-400">
            {followUp.sessions.length} session
            {followUp.sessions.length === 1 ? "" : "s"} hidden
          </div>
        ) : (
          followUp.sessions.map((s) => {
            const target = new Date(s.scheduledAt).getTime();
            const live = liveSessionState(s.status, s.scheduledAt, now);
            const started =
              s.status === "completed" ||
              (Number.isFinite(target) && target <= now);
            const docsUnlocked =
              s.status === "completed" ||
              (workable && s.status === "scheduled" && started);
            return (
              <article
                key={s.id}
                className="overflow-hidden rounded-[14px] border border-slate-200 dark:border-white/10"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    <User className="size-[18px]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[15px] font-semibold leading-5 dark:text-slate-100">
                      {sessionTypeLabel(s.sessionType)}
                    </h4>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" aria-hidden />
                        <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden />
                        {formatTime(s.scheduledAt)}
                      </span>
                      {s.venue ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5" aria-hidden />
                          {s.venue}
                        </span>
                      ) : null}
                    </p>
                    {s.status === "scheduled" && Number.isFinite(target) ? (
                      <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400" aria-live="off">
                        {target > now
                          ? `Starts in ${formatCountdown(target - now)}`
                          : "Ongoing now"}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill live={live} />
                </div>

                {(s.status === "completed" && (s.sessionNotes || s.outcome)) ||
                (s.status === "cancelled" && s.cancelReason) ? (
                  <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-5 dark:border-white/10 dark:bg-white/5">
                    {s.status === "completed" && s.sessionNotes ? (
                      <>
                        <dt className="text-slate-500 dark:text-slate-400">Notes</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{s.sessionNotes}</dd>
                      </>
                    ) : null}
                    {s.status === "completed" && s.outcome ? (
                      <>
                        <dt className="text-slate-500 dark:text-slate-400">Outcome</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{s.outcome}</dd>
                      </>
                    ) : null}
                    {s.status === "cancelled" && s.cancelReason ? (
                      <>
                        <dt className="text-slate-500 dark:text-slate-400">Reason</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{s.cancelReason}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}

                {docsUnlocked ? (
                  <div className="flex items-center border-t border-slate-200 px-4 py-2.5 dark:border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={locked || isActionPending}
                      onClick={() => setDocsFor(s)}
                      className="h-8 gap-1.5 rounded-lg border-slate-200 px-3 text-[13px] font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
                    >
                      <ImageIcon className="size-3.5" aria-hidden />
                      {(s.attachmentsCount ?? 0) > 0 ? "See attached images" : "Add docs"}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {expanded && (upcoming || (!upcoming && workable && followUp.sessions.length > 0)) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!upcoming && workable && (
            <Button
              type="button"
              size="sm"
              disabled={locked || isActionPending}
              onClick={onSchedule}
              className="h-8 rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white hover:bg-blue-700"
            >
              Book session
            </Button>
          )}
          {upcoming && workable && (
            <>
              <Button
                type="button"
                size="sm"
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
                className="h-8 rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                <Busy busy={isBusy("finish")} />
                Mark done
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={() => onSession(upcoming, "move")}
                className="h-8 rounded-lg border-slate-300 px-3 text-[13px] font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Reschedule session
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={() => onSession(upcoming, "cancelSess")}
                className="h-8 rounded-lg border-slate-300 px-3 text-[13px] font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      ) : null}

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
