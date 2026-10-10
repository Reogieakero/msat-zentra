"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatElapsedShort, msSinceDate as msSinceAction } from "@/lib/clock";
import { TableCell, TableRow } from "@/components/ui/table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "@/services/guidance/interventions.types";
import { useInterventionEngine } from "./intervention-engine-breakdown";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { ActionGlyph } from "./intervention-action-glyph";
import { interventionLatestAction, pipelineStatus } from "./intervention-row-helpers";
import { useRowViewer } from "./use-row-viewer";
import { InterventionRowMenu } from "./intervention-row-menu";
import { InterventionDetailSheet } from "./intervention-detail-sheet";
import { SessionListDialog } from "./session-list-dialog";
import styles from "./guidance-interventions.module.css";
export { interventionLatestAction } from "./intervention-row-helpers";
interface InterventionTableRowProps {
  row: AtRiskStudentItem;
  highlighted?: boolean;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  planCollapsed: boolean;
  onTogglePlan: () => void;
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
  planCollapsed,
  onTogglePlan,
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
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const { viewer, setViewer, viewerLoading, openRowViewer, filesTotal } = useRowViewer(followUp);
  const closed = !!followUp && followUp.outcomeStatus === "resolved";
  const canScheduleFollowUp =
    !!followUp &&
    !closed &&
    followUp.approvalStatus !== "rejected" &&
    followUp.completedSessions > 0;
  const workable =
    !!followUp &&
    followUp.outcomeStatus !== "resolved" &&
    followUp.approvalStatus !== "rejected";
  const latest = interventionLatestAction(row);
  const actionMs = latest.time ? msSinceAction(latest.time, now) : null;
  const doneCount = followUp?.completedSessions ?? 0;
  const scheduledCount =
    followUp?.sessions.filter((s) => s.status === "scheduled").length ?? 0;
  const scheduledSession =
    followUp?.sessions.find((s) => s.status === "scheduled") ?? null;
  const canReschedule =
    !!scheduledSession &&
    !closed &&
    followUp?.approvalStatus !== "rejected" &&
    doneCount === 0;
  const status = pipelineStatus(row, followUp, scheduledCount, doneCount);
  const isUnbooked =
    !!followUp && !closed && followUp.sessions.length === 0;
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
  const detectedDate = (() => {
    if (!detectedAt) return null;
    const d = new Date(detectedAt);
    return Number.isFinite(d.getTime()) ? d : null;
  })();
  const detectedText = detectedDate
    ? detectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const detectedTimeText = detectedDate
    ? detectedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <>
      <TableRow
        id={`intervention-row-${row.studentKey}`}
        data-highlighted={highlighted || undefined}
        className={highlighted ? styles.rowHighlight : undefined}
      >
        <TableCell>
          <p className={styles.studentName}>{row.student}</p>
          <p className={styles.cellSub}>
            <span className={styles.lrn}>{row.lrn || "—"}</span>
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{row.grade || "—"}</p>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{row.section || "—"}</p>
        </TableCell>
        <TableCell>
          <Badge
            variant={
              row.riskLevel === "High"
                ? "red"
                : row.riskLevel === "Moderate"
                  ? "amber"
                  : "outline"
            }
          >
            {row.riskLevel}
          </Badge>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{detectedText}</p>
          <p className={styles.cellSub} aria-live="off">
            {detectedTimeText ?? "—"}
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
          <p className={styles.cellSub} aria-live="off">
            {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
          </p>
        </TableCell>
        <TableCell>
          <Badge variant={status.variant}>{status.label}</Badge>
          {status.sub ? <p className={styles.cellSub}>{status.sub}</p> : null}
        </TableCell>
        <TableCell>
          {closed ? (
            <Badge variant="green">
              <Check aria-hidden className={styles.actionIcon} />
              Done
            </Badge>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={!canMarkDone || isBusy("outcome")}
              title={markDoneHint ?? "Record the outcome as resolved"}
              aria-label={
                canMarkDone
                  ? `Mark ${row.student}'s intervention as done`
                  : `Cannot mark ${row.student}'s intervention as done: ${markDoneHint}`
              }
              onClick={onMarkDone}
            >
              {isBusy("outcome") ? "Saving…" : "Mark as done"}
            </Button>
          )}
        </TableCell>
        <TableCell>
          <InterventionRowMenu
            row={row}
            closed={closed}
            isUnbooked={isUnbooked}
            scheduledSession={scheduledSession}
            canReschedule={canReschedule}
            canScheduleFollowUp={canScheduleFollowUp}
            workable={workable}
            filesTotal={filesTotal}
            viewerLoading={viewerLoading}
            locked={locked}
            isActionPending={isActionPending}
            onToggleDetails={onToggleDetails}
            onSessionsOpen={() => setSessionsOpen(true)}
            onHistoryOpen={() => setHistoryOpen(true)}
            onOpenViewer={() => void openRowViewer()}
            onStart={onStart}
            onSchedule={onSchedule}
            onSession={onSession}
          />
          <SessionListDialog
            row={row}
            followUp={followUp}
            sessionsOpen={sessionsOpen}
            historyOpen={historyOpen}
            onSessionsOpenChange={setSessionsOpen}
            onHistoryOpenChange={setHistoryOpen}
            now={now}
          />
        </TableCell>
      </TableRow>
      <InterventionDetailSheet
        row={row}
        followUp={followUp}
        expanded={expanded}
        onToggleDetails={onToggleDetails}
        displayLevel={displayLevel}
        status={status}
        detectedText={detectedText}
        detectedTimeText={detectedTimeText}
        planCollapsed={planCollapsed}
        onTogglePlan={onTogglePlan}
        locked={locked}
        isActionPending={isActionPending}
        isBusy={isBusy}
        workable={workable}
        closed={closed}
        isUnbooked={isUnbooked}
        hasUpcoming={hasUpcoming}
        upcomingHint={upcomingHint}
        onStart={onStart}
        onChange={onChange}
        onOutcome={onOutcome}
        onSchedule={onSchedule}
        onSession={onSession}
        onReview={onReview}
        onDocsChanged={onDocsChanged}
      />
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
