"use client";
import * as React from "react";
import { CalendarCheck, CalendarPlus, Check, Clock } from "lucide-react";
import { formatElapsedShort, msSinceDate as msSinceAction } from "@/lib/clock";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill, type PillTone } from "@/components/ui/pill";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "@/services/guidance/interventions.types";
import { useInterventionEngine } from "./intervention-engine-breakdown";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { ActionGlyph } from "./intervention-action-glyph";
import { interventionLatestAction, pipelineStatus } from "./intervention-row-helpers";
import { useRowViewer } from "./use-row-viewer";
import { GuidanceCaseDetailDialog } from "../../components/GuidanceCaseDetailDialog";
import type { CaseDetailSession } from "../../components/GuidanceCaseDetailDialog";
import { InterventionSessionDocsDialog } from "./InterventionSessionDocsDialog";
import { SessionListDialog } from "./session-list-dialog";
import styles from "./guidance-interventions.module.css";
export { interventionLatestAction } from "./intervention-row-helpers";

const ACTION_PRIMARY =
  "inline-flex h-6 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";
const ACTION_BOOK =
  "inline-flex h-6 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50";
const ACTION_SECONDARY =
  "inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";
interface InterventionTableRowProps {
  row: AtRiskStudentItem;
  highlighted?: boolean;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  expanded: boolean;
  onToggleDetails: () => void;
  now: number;
  onStart: () => void;
  onChange: () => void;
  onOutcome: () => void;
  onMarkDone: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
}
export function InterventionTableRow({
  row,
  highlighted = false,
  locked,
  isActionPending,
  isBusy,
  expanded,
  onToggleDetails,
  now,
  onStart,
  onChange,
  onOutcome,
  onMarkDone,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
}: InterventionTableRowProps) {
  const followUp = row.intervention;
  const engine = useInterventionEngine(row.studentKey, expanded);
  const displayLevel = engine.data?.live.level ?? row.riskLevel;
  const [sessionsOpen, setSessionsOpen] = React.useState(false);
  const { viewer, setViewer } = useRowViewer(followUp);
  const closed = !!followUp && followUp.outcomeStatus === "resolved";
  const workable =
    !!followUp &&
    followUp.outcomeStatus !== "resolved" &&
    followUp.approvalStatus !== "rejected";
  const latest = interventionLatestAction(row);
  const actionMs = latest.time ? msSinceAction(latest.time, now) : null;
  const doneCount = followUp?.completedSessions ?? 0;
  const scheduledCount =
    followUp?.sessions.filter((s) => s.status === "scheduled").length ?? 0;
  const status = pipelineStatus(row, followUp, scheduledCount, doneCount);
  const isUnbooked =
    !!followUp && !closed && followUp.sessions.length === 0;
  const hasSessions = (followUp?.sessions.length ?? 0) > 0;
  const hasUpcoming = scheduledCount > 0;
  const upcomingHint = "Finish or cancel the upcoming session first";
  // Mark-as-done is enabled for ongoing plans except when there is
  // nothing actionable yet: no sessions booked ("No action yet") or a
  // booked session that hasn't started. The outcome dialog + backend
  // enforce the remaining rules (reviewed, closing note) with clear errors.
  const hasFutureBooking = (followUp?.sessions ?? []).some(
    (s) =>
      s.status === "scheduled" &&
      (() => {
        const t = new Date(s.scheduledAt).getTime();
        return !Number.isFinite(t) || t > now;
      })()
  );
  const markDoneHint = !followUp
    ? "Start a follow-up first"
    : followUp.outcomeStatus === "resolved"
      ? "Already done"
      : followUp.outcomeStatus !== "ongoing"
        ? "Already closed"
        : followUp.sessions.length === 0
          ? "Book a session first"
          : hasFutureBooking
            ? "The booked session hasn't started yet"
            : null;
  const canMarkDone = markDoneHint === null && !locked && !isActionPending;
  const detectedAt = row.detectedAt ?? followUp?.createdAt ?? null;
  const detectedMs = detectedAt ? msSinceAction(detectedAt, now) : null;
  const detectedElapsed =
    detectedMs === null
      ? "—"
      : detectedMs < 60_000
        ? "just now"
        : `${formatElapsedShort(detectedMs)} ago`;
  const statusTone: PillTone =
    status.variant === "green" || status.variant === "success"
      ? "green"
      : status.variant === "warning"
        ? "amber"
        : status.variant === "destructive"
          ? "red"
          : "neutral";
  const riskTone: PillTone =
    displayLevel === "High"
      ? "red"
      : displayLevel === "Moderate"
        ? "amber"
        : "neutral";
  const riskLevel: "High" | "Moderate" | "Low" | undefined =
    displayLevel === "High" || displayLevel === "Moderate" || displayLevel === "Low"
      ? displayLevel
      : undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleDetails();
    }
  };

  return (
    <>
      <li
        id={`intervention-row-${row.studentKey}`}
        data-highlighted={highlighted || undefined}
        className={`${styles.caseRow}${highlighted ? ` ${styles.caseRowHighlight}` : ""}${
          expanded ? ` ${styles.caseRowActive}` : ""
        }`}
        onClick={onToggleDetails}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={`${row.student}'s intervention case`}
      >
        <div className={styles.caseCardHead}>
          <StudentMascot name={row.student} seed={row.lrn} size={36} />
          <div className={styles.caseCardId}>
            <p className={styles.caseCardName}>{row.student}</p>
            <div className={styles.caseCardMeta}>
              <Pill label="LRN" className="tabular-nums">
                {row.lrn || "—"}
              </Pill>
              <Pill
                tone="amber"
                aria-label={`Section ${row.section}`}
                label={row.grade || "Grade level"}
              >
                {row.section || "—"}
              </Pill>
            </div>
          </div>
          <Pill tone={riskTone} label="Risk level">
            {displayLevel}
          </Pill>
        </div>

        <div className={styles.caseCardPills}>
          <Pill tone="amber" label="Case type">
            Intervention
          </Pill>
          <Pill tone={statusTone} label="Status">
            {status.label}
          </Pill>
          {doneCount > 0 && !closed ? (
            <Pill label="Sessions completed">
              {doneCount} session{doneCount === 1 ? "" : "s"} done
            </Pill>
          ) : null}
        </div>

        <div className={styles.caseCardFoot}>
          <Pill label="Detected at" className="tabular-nums">
            <Clock size={11} aria-hidden />
            {detectedElapsed}
          </Pill>

          <div
            className={styles.caseActions}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={styles.actionIconButton} aria-label={latest.label} tabIndex={0}>
                    <ActionGlyph label={latest.label} className={styles.actionIcon} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <span className="font-medium">{latest.label}</span>
                  {actionMs === null ? null : (
                    <span className="opacity-60">{formatElapsedShort(actionMs)} ago</span>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {hasSessions ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={styles.actionIconButton}
                      aria-label={`Booked sessions for ${row.student}`}
                      onClick={() => setSessionsOpen(true)}
                    >
                      <CalendarCheck className={styles.actionIcon} aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <span className="font-medium">Booked session</span>
                    <span className="opacity-60">
                      {followUp?.sessions.length ?? 0} session
                      {(followUp?.sessions.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}

            {(!followUp || (workable && !hasUpcoming)) && (
              <button
                type="button"
                className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[0.6875rem] font-semibold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "rgb(59 130 246 / 0.15)", color: "#1d4ed8" }}
                disabled={
                  locked ||
                  isActionPending ||
                  (!!followUp && isBusy("schedule"))
                }
                title={
                  followUp && !workable
                    ? "This follow-up is closed"
                    : "Book a counseling session"
                }
                onClick={() => {
                  if (!followUp) onStart();
                  else onSchedule();
                }}
              >
                <CalendarPlus size={11} aria-hidden />
                Book session
              </button>
            )}

            {closed ? (
              <Pill tone="green" label="Outcome">
                <Check size={11} aria-hidden />
                Done
              </Pill>
            ) : (
              <button
                type="button"
                className={styles.markDoneBtn}
                disabled={!canMarkDone || isBusy("outcome")}
                title={markDoneHint ?? "Record the outcome as resolved"}
                aria-label={
                  canMarkDone
                    ? `Mark ${row.student}'s intervention as done`
                    : `Cannot mark ${row.student}'s intervention as done: ${markDoneHint}`
                }
                onClick={onMarkDone}
              >
                {isBusy("outcome") ? "Saving…" : "Mark done"}
              </button>
            )}
          </div>
          <SessionListDialog
            row={row}
            followUp={followUp}
            open={sessionsOpen}
            onClose={() => setSessionsOpen(false)}
            now={now}
          />
        </div>
      </li>
      {expanded ? (
        <GuidanceCaseDetailDialog
          row={{ kind: "intervention", item: row }}
          riskLevel={riskLevel}
          onClose={onToggleDetails}
          showOpenFullCase={false}
          sessionActions={(session) => (
            <CaseSessionActions
              session={session}
              followUpId={followUp?.id ?? null}
              now={now}
              workable={workable}
              closed={closed}
              locked={locked}
              isActionPending={isActionPending}
              isBusy={isBusy}
              onSession={(target, dialog) => {
                onToggleDetails();
                onSession(target, dialog);
              }}
              onDocsChanged={onDocsChanged}
            />
          )}
          actions={
            <>
              {!followUp && (
                <button
                  type="button"
                  className={ACTION_BOOK}
                  disabled={locked || isActionPending}
                  title="Start the follow-up and book the first session"
                  onClick={() => {
                    onToggleDetails();
                    onStart();
                  }}
                >
                  {isBusy("start") ? "Saving…" : "Book session"}
                </button>
              )}
              {isUnbooked && (
                <button
                  type="button"
                  className={ACTION_BOOK}
                  disabled={locked || isActionPending}
                  onClick={() => {
                    onToggleDetails();
                    onSchedule();
                  }}
                >
                  Book session
                </button>
              )}
              {followUp?.approvalStatus === "pending" && (
                <>
                  <button
                    type="button"
                    className={ACTION_SECONDARY}
                    disabled={locked || isActionPending}
                    onClick={() => {
                      onToggleDetails();
                      onChange();
                    }}
                  >
                    Change…
                  </button>
                  <button
                    type="button"
                    className={ACTION_SECONDARY}
                    disabled={locked || isActionPending}
                    onClick={() => {
                      onToggleDetails();
                      onReview("rejected");
                    }}
                  >
                    {isBusy("review") ? "Saving…" : "Reject"}
                  </button>
                  <button
                    type="button"
                    className={ACTION_PRIMARY}
                    disabled={locked || isActionPending}
                    onClick={() => {
                      onToggleDetails();
                      onReview("approved");
                    }}
                  >
                    {isBusy("review") ? "Saving…" : "Approve"}
                  </button>
                </>
              )}
              {followUp && !closed && status.label !== "No action yet" && (
                <button
                  type="button"
                  className={ACTION_SECONDARY}
                  disabled={locked || isActionPending || hasUpcoming}
                  title={hasUpcoming ? upcomingHint : undefined}
                  onClick={() => {
                    onToggleDetails();
                    onOutcome();
                  }}
                >
                  Record outcome…
                </button>
              )}
              {followUp && closed && (
                <>
                  <button
                    type="button"
                    className={ACTION_SECONDARY}
                    disabled={locked || isActionPending}
                    title="Update the closing notes on this finished follow-up"
                    onClick={() => {
                      onToggleDetails();
                      onOutcome();
                    }}
                  >
                    Add note
                  </button>
                  <button
                    type="button"
                    className={ACTION_PRIMARY}
                    disabled={locked || isActionPending}
                    title="This student is still at risk — open a new follow-up"
                    onClick={() => {
                      onToggleDetails();
                      onStart();
                    }}
                  >
                    {isBusy("start") ? "Saving…" : "Start new follow-up"}
                  </button>
                </>
              )}
            </>
          }
        />
      ) : null}
      {viewer && (
        <ImageViewer
          files={viewer.files}
          index={viewer.index}
          title={row.student}
          subtitle={`${row.lrn || "—"}${row.section ? ` · ${row.section}` : ""}${row.grade ? ` · ${row.grade}` : ""}`}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}

/**
 * Per-session actions inside the shared case overlay — mirrors the old
 * counseling-plan controls (finish / reschedule / cancel / docs).
 */
function CaseSessionActions({
  session,
  followUpId,
  now,
  workable,
  closed,
  locked,
  isActionPending,
  isBusy,
  onSession,
  onDocsChanged,
}: {
  session: CaseDetailSession;
  followUpId: string | null;
  now: number;
  workable: boolean;
  closed: boolean;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onDocsChanged: () => void;
}) {
  const [docsOpen, setDocsOpen] = React.useState(false);
  const fullSession = session as CounselingSessionItem;
  const target = new Date(session.scheduledAt).getTime();
  const started = session.status === "completed" || (Number.isFinite(target) && target <= now);
  const actionable = workable && !closed && session.status === "scheduled";
  const docsUnlocked =
    session.status === "completed" ||
    (workable && session.status === "scheduled" && started);
  const docsCount = fullSession.attachmentsCount ?? 0;

  if (!actionable && !docsUnlocked) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actionable && (
        <>
          <button
            type="button"
            className={ACTION_PRIMARY}
            disabled={locked || isActionPending || target > now}
            title={
              target > now
                ? "You can mark it done once the scheduled time arrives"
                : undefined
            }
            onClick={() => onSession(fullSession, "finish")}
          >
            {isBusy("finish") ? "Saving…" : "Mark done"}
          </button>
          <button
            type="button"
            className={ACTION_SECONDARY}
            disabled={locked || isActionPending}
            onClick={() => onSession(fullSession, "move")}
          >
            Reschedule
          </button>
          <button
            type="button"
            className={ACTION_SECONDARY}
            disabled={locked || isActionPending}
            onClick={() => onSession(fullSession, "cancelSess")}
          >
            Cancel
          </button>
        </>
      )}
      {docsUnlocked && (
        <>
          <button
            type="button"
            className={ACTION_SECONDARY}
            disabled={locked || isActionPending}
            onClick={() => setDocsOpen(true)}
          >
            {docsCount > 0 ? "See attached images" : "Add docs"}
          </button>
          {docsOpen && followUpId ? (
            <InterventionSessionDocsDialog
              followUpId={followUpId}
              session={fullSession}
              open
              onClose={() => setDocsOpen(false)}
              onChanged={onDocsChanged}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
