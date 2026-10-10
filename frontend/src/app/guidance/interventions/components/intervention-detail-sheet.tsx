"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Check, CheckCircle2, Clock, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "@/services/guidance/interventions.types";
import { CounselingPlan } from "./counseling-plan";
import { EngineBreakdown } from "./intervention-engine-breakdown";
import { Busy } from "./busy";
import { approvalLabel, outcomeLabel } from "./intervention-row-helpers";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => /^[A-Za-z]/.test(p));
  if (parts.length === 0) return "–";
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : "";
  return `${first}${last}`;
}

export function InterventionDetailSheet({
  row,
  followUp,
  expanded,
  onToggleDetails,
  displayLevel,
  status,
  detectedText,
  detectedTimeText,
  planCollapsed,
  onTogglePlan,
  locked,
  isActionPending,
  isBusy,
  workable,
  closed,
  isUnbooked,
  hasUpcoming,
  upcomingHint,
  onStart,
  onChange,
  onOutcome,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
}: {
  row: AtRiskStudentItem;
  followUp: AtRiskStudentItem["intervention"];
  expanded: boolean;
  onToggleDetails: () => void;
  displayLevel: string;
  status: {
    label: string;
    variant: "default" | "success" | "secondary" | "destructive" | "outline" | "warning" | "green";
    sub: string | null;
  };
  detectedText: string;
  detectedTimeText: string | null;
  planCollapsed: boolean;
  onTogglePlan: () => void;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  workable: boolean;
  closed: boolean;
  isUnbooked: boolean;
  hasUpcoming: boolean;
  upcomingHint: string;
  onStart: () => void;
  onChange: () => void;
  onOutcome: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
}) {
  const risk = displayLevel.toLowerCase();
  const riskPill =
    risk === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-200"
      : risk === "moderate" || risk === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
        : "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200";
  const riskDot =
    risk === "high"
      ? "bg-red-600 dark:bg-red-400"
      : risk === "moderate" || risk === "medium"
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-green-600 dark:bg-green-400";
  const riskLabel =
    risk === "moderate" ? "Moderate" : displayLevel.charAt(0).toUpperCase() + displayLevel.slice(1).toLowerCase();
  const noteText = [followUp?.recommendedAction, followUp?.intakeNotes]
    .filter((t) => t && t.trim() !== "")
    .join(" — ");
  const completedSessions =
    followUp?.sessions.filter((s) => s.status === "completed") ?? [];
  const lastCompleted = completedSessions[completedSessions.length - 1] ?? null;
  const closedOn = (() => {
    const raw = lastCompleted?.completedAt || lastCompleted?.createdAt || null;
    if (!raw) return detectedText;
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return detectedText;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();
  // Custom drawer chrome (no shadcn/Radix): enter/exit slide, Esc to
  // close, body scroll lock, initial focus + a lightweight focus trap.
  const [mounted, setMounted] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const prevFocused = React.useRef<Element | null>(null);

  React.useEffect(() => {
    // Mounted flag guards the document.body portal during prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!expanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntered(false);
      return;
    }
    prevFocused.current = document.activeElement;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    );
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the panel once it slides in.
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onToggleDetails();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
      if (prevFocused.current instanceof HTMLElement) prevFocused.current.focus();
    };
    // onToggleDetails is stable enough per render; re-run only on open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, mounted]);

  if (!mounted || !expanded) return null;

  const drawer = (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* backdrop */}
      <div
        aria-hidden
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onToggleDetails();
        }}
        className={`absolute inset-0 bg-black/10 supports-backdrop-filter:backdrop-blur-xs transition-opacity duration-200 ${entered ? "opacity-100" : "opacity-0"}`}
      />
      {/* panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
        aria-describedby="case-drawer-description"
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-full flex-col gap-0 bg-popover text-sm text-popover-foreground shadow-lg transition-transform duration-200 ease-in-out sm:w-1/2 ${entered ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* ---------- header ---------- */}
        <div className="space-y-3.5 border-b border-slate-200 px-6 pb-[18px] pt-5 text-left dark:border-white/10">
          <div className="flex items-start gap-3.5">
            <div
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
            >
              {initialsOf(row.student)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="case-drawer-title" className="text-xl font-semibold leading-[26px] dark:text-slate-100">
                {row.student}
              </h2>
              <p id="case-drawer-description" className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
                LRN {row.lrn || "—"} · Grade {row.grade || "—"} · Section{" "}
                {row.section || "—"}
              </p>
              <p className="sr-only">
                Case details for {row.student}. Press Escape to close.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onToggleDetails}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full py-[3px] pl-2 pr-2.5 text-xs font-medium",
                riskPill
              )}
            >
              <span className={cn("size-1.5 rounded-full", riskDot)} aria-hidden />
              {riskLabel} risk
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full py-[3px] pl-2 pr-2.5 text-xs font-medium",
                closed
                  ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200"
                  : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
              )}
            >
              {closed && <Check className="size-3" strokeWidth={3} aria-hidden />}
              {status.label}
            </span>
            <span className="ml-1 inline-flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              <Clock className="size-3.5" aria-hidden />
              Detected {detectedText}
              {detectedTimeText ? ` · ${detectedTimeText}` : ""}
            </span>
          </div>
        </div>

        {/* ---------- body ---------- */}
        <div className="@container min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-6 [scrollbar-width:thin] [scrollbar-color:var(--primary)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-(--primary) [&::-webkit-scrollbar-track]:bg-transparent">
          {(closed || noteText) && (
            <section className="space-y-2.5">
              {closed && followUp && (
                <div className="flex gap-3 rounded-[14px] border border-green-200 bg-green-50 px-4 py-3.5 dark:border-green-500/30 dark:bg-green-500/10">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                    <CheckCircle2 className="size-[18px]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 text-[13px] leading-[18px] text-green-800 dark:text-green-200">
                    <p className="text-sm font-semibold leading-5 text-green-900 dark:text-green-100">
                      Resolved
                    </p>
                    <p>Automatically closed after the final session on {closedOn}.</p>
                    {(followUp.outcomeNotes || lastCompleted?.sessionNotes) && (
                      <p className="mt-2 flex flex-wrap gap-x-5">
                        {followUp.outcomeNotes && (
                          <span>
                            <span className="opacity-80">Outcome</span>{" "}
                            <b className="font-semibold">{followUp.outcomeNotes}</b>
                          </span>
                        )}
                        {lastCompleted?.sessionNotes && (
                          <span>
                            <span className="opacity-80">Last session notes</span>{" "}
                            <b className="font-semibold">{lastCompleted.sessionNotes}</b>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {noteText && (
                <div className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <FileText
                    className="mt-px size-[18px] shrink-0 text-slate-500 dark:text-slate-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase leading-4 tracking-[0.04em] text-slate-500 dark:text-slate-400">
                      Note
                    </p>
                    <p className="mt-0.5 text-sm leading-5 text-slate-900 dark:text-slate-100">{noteText}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* why at risk */}
          <section className="space-y-3">
            <h3 className="text-[15px] font-semibold leading-5 dark:text-slate-100">Why at risk</h3>
            <EngineBreakdown
              studentKey={row.studentKey}
              factors={row.factors}
              openReferrals={row.referralContext.open}
              closedReferrals={row.referralContext.closed}
              highPriority={followUp?.priority === "high"}
            />
          </section>

          {/* counseling plan */}
          <section>
            {!followUp ? (
              <p className="rounded-[14px] border border-slate-200 px-4 py-3.5 text-[13px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                No follow-up yet
              </p>
            ) : (
              <div>
                {(followUp.approvalStatus !== "approved" ||
                  followUp.outcomeStatus !== "ongoing") && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {followUp.approvalStatus !== "approved" && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                        {approvalLabel(followUp.approvalStatus)}
                      </span>
                    )}
                    {followUp.outcomeStatus !== "ongoing" && !closed && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {outcomeLabel(followUp.outcomeStatus)}
                      </span>
                    )}
                  </div>
                )}
                <CounselingPlan
                  followUp={followUp}
                  studentFirstName={row.student.split(" ")[0]}
                  workable={workable}
                  closed={closed}
                  rejected={followUp.approvalStatus === "rejected"}
                  collapsed={planCollapsed}
                  onToggle={onTogglePlan}
                  locked={locked}
                  isActionPending={isActionPending}
                  isBusy={isBusy}
                  onSchedule={onSchedule}
                  onSession={onSession}
                  onDocsChanged={onDocsChanged}
                />
              </div>
            )}
          </section>
        </div>

        {/* ---------- footer ---------- */}
        <div className="mt-auto flex flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-popover">
          {!followUp && (
            <Button
              type="button"
              disabled={locked || isActionPending}
              onClick={onStart}
              title="Start the follow-up and book the first session"
              className="h-8 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Busy busy={isBusy("start")} />
              Book session
            </Button>
          )}
          {isUnbooked && (
            <Button
              type="button"
              disabled={locked || isActionPending}
              onClick={onSchedule}
              className="h-8 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Book session
            </Button>
          )}
          {followUp?.approvalStatus === "pending" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={onChange}
                className="h-8 rounded-[8px] border-slate-300 px-4 text-sm font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Change…
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={() => onReview("rejected")}
                className="h-8 rounded-[8px] border-slate-300 px-4 text-sm font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                <Busy busy={isBusy("review")} />
                Reject
              </Button>
              <Button
                type="button"
                disabled={locked || isActionPending}
                onClick={() => onReview("approved")}
                className="h-8 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Busy busy={isBusy("review")} />
                Approve
              </Button>
            </>
          )}
          {followUp && !closed && status.label !== "No action yet" && (
            <Button
              type="button"
              variant="outline"
              disabled={locked || isActionPending || hasUpcoming}
              title={hasUpcoming ? upcomingHint : undefined}
              onClick={onOutcome}
              className="h-8 rounded-[8px] border-slate-300 px-4 text-sm font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
            >
              Record outcome…
            </Button>
          )}
          {followUp && closed && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={onOutcome}
                title="Update the closing notes on this finished follow-up"
                className="h-8 rounded-[8px] border-slate-300 px-4 text-sm font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                Add note
              </Button>
              <Button
                type="button"
                disabled={locked || isActionPending}
                onClick={onStart}
                title="This student is still at risk — open a new follow-up"
                className="h-8 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Busy busy={isBusy("start")} />
                Start new follow-up
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  return createPortal(drawer, document.body);
}
