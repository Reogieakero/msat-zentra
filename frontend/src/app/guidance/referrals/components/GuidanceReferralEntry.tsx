"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import {
  buildGcForm03Data,
  consultRecommendation,
  type GcForm03Data,
} from "../../adm/components/gcform03-data";
import { GcForm03PreviewDialog } from "../../adm/components/GcForm03PreviewDialog";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "./guidance-referrals-data";
import {
  formatActionTime,
  formatDate,
  formatStatus,
  hasScheduledSession,
  initials,
  latestActionOf,
  roleLabel,
  rowStatusHelp,
  rowStatusLabel,
  sessionTypeLabel,
  statusVariant,
  timeAgo,
  watermarkLabel,
  watermarkColor,
} from "./guidance-referrals-format";
import { SessionPlanCard } from "@/components/session-plan/SessionPlanCard";
import { SessionDocsDialog } from "./GuidanceSessionDocsDialog";
import styles from "./GuidanceReferralEntry.module.css";

export type GuidanceDialogKey =
  | "escalate"
  | "reassign"
  | "note"
  | "followUp"
  | "dismiss"
  | "specialist"
  | "adm"
  | "accept"
  | "schedule"
  | "resolve";

export type GuidanceSessionDialogKey = "finish" | "move" | "cancelSess" | "deleteSess";

/* Day (YYYY-MM-DD) of the row's latest action for the viewed form's
   received/counselor dates — the builder would otherwise stamp today. */
function latestActionDay(time: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(time);
  return m ? m[1] : null;
}

export function GuidanceReferralEntry({
  row,
  alt,
  now,
  actionPending,
  onOpenDialog,
  onOpenSession,
  onPreview,
  onPrivacy,
  onEndorsedNotice,
  onReviewAdm,
  onChanged,
  highlighted = false,
}: {
  row: GuidanceReferralItem;
  alt: boolean;
  now: number;
  actionPending: boolean;
  onOpenDialog: (referralId: string, dialog: GuidanceDialogKey) => void;
  onOpenSession: (
    referralId: string,
    session: CounselingSessionItem,
    dialog: GuidanceSessionDialogKey
  ) => void;
  onPreview: (recordId: string) => void;
  onPrivacy: (studentName: string) => void;
  onEndorsedNotice: (studentName: string) => void;
  onReviewAdm: (row: GuidanceReferralItem) => void;
  onChanged: () => void;
  highlighted?: boolean;
}) {
  const isPending = row.status === "pending";
  const isDismissed = row.status === "dismissed";
  const isClosed = row.status === "resolved" || isDismissed;
  // Action track: ADM-bound cases (moving toward the ADM coordinator) stay
  // read-only once decided — same as endorsed ADM on the nurse desk.
  // Pending ADM consultations stay manageable (booked from review without
  // deciding) until the case is confirmed. Counseling cases run the full
  // accept → sessions → close workflow.
  const isAdmTrack = row.type === "ADM";
  // Endorsed ADM cases moved to the coordinator with their full report —
  // the anecdotal write-up is no longer viewable on this desk.
  const isEndorsedRow = isAdmTrack && row.status === "in_progress";
  const canManageSessions = !isAdmTrack || (isAdmTrack && row.status === "pending");
  const latest = latestActionOf(row);
  const booked = hasScheduledSession(row.sessions);
  const [docsFor, setDocsFor] = React.useState<CounselingSessionItem | null>(null);
  // Endorsed GCForm-03 (Control No. GCForm-03) viewer — rebuilt from the
  // case + its OCForm-01, exactly like the endorse-time preview, since the
  // filled form itself lives with the ADM coordinator.
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);

  async function openGcForm() {
    if (gcLoading) return;
    if (gcData) {
      setGcOpen(true);
      return;
    }
    setGcLoading(true);
    try {
      let report: OcForm01Detail | null = null;
      try {
        if (row.anecdotalId) report = await fetchOcForm01Detail(row.anecdotalId);
      } catch {
        report = null;
      }
      const data = buildGcForm03Data(
        row,
        report,
        consultRecommendation(row.notes)
      );
      const day = latestActionDay(latest.time);
      if (day) {
        data.receivedDate = day;
        data.counselorDate = day;
      }
      setGcData(data);
      setGcOpen(true);
    } finally {
      setGcLoading(false);
    }
  }

  return (
    <>
    <li id={`guidance-case-${row.id}`} className={`${styles.entry}${alt ? ` ${styles.entryAlt}` : ""}${highlighted ? ` ${styles.entryHighlight}` : ""}`}>
      <span className={`${styles.watermark} ${styles["watermark" + watermarkColor(row).replace(/^./, c => c.toUpperCase())]}`} aria-hidden="true">
        {watermarkLabel(row)}
      </span>
      <span className={styles.dot} aria-hidden="true" />
      {/* Date rail — always left, sticks below the toolbar */}
      <div className={`${styles.rail} ${styles.railSticky}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p className={styles.railDate}>
            <time dateTime={row.date}>{formatDate(row.date)}</time>
          </p>
          <div className={styles.railBadges}>
            <Badge variant={statusVariant(row.status, row.type)}>
              {rowStatusLabel(row.type, row.status)}
            </Badge>
            <Badge variant={isAdmTrack ? "secondary" : "outline"}>
              {row.type}
            </Badge>
            <Badge variant="outline">
              {formatStatus(row.category)}
            </Badge>
            {row.priority === "high" ? (
              <Badge variant="destructive">High priority</Badge>
            ) : null}
            {row.priority === "low" ? (
              <Badge variant="outline">Low priority</Badge>
            ) : null}
          </div>
        </div>
        {rowStatusHelp(row.type, row.status) ? (
          <p className={styles.statusHelp}>
            {rowStatusHelp(row.type, row.status)}
          </p>
        ) : null}
        <p className={styles.railMeta}>Sent by {row.referredBy}</p>
        <p className={styles.railMeta}>
          Observed by {row.observer || "not recorded"}
        </p>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.625rem", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <p className={styles.blockLabel}>Latest action</p>
          <p className={styles.statusHelp}>{latest.label}</p>
          <p className={styles.railMeta}>
            <time dateTime={latest.time}>{formatActionTime(latest.time)}</time>
          </p>
        </div>
        <div
          className={styles.studentCard}
          aria-label={`About the student: ${row.student}`}
        >
          <p className={styles.studentCaption}>Student</p>
          <div className={styles.studentRow}>
            <Avatar className={styles.avatar} aria-hidden="true">
              <AvatarFallback>{initials(row.student)}</AvatarFallback>
            </Avatar>
            <div className={styles.studentText}>
              <p className={styles.studentName}>{row.student}</p>
              {row.lrn ? (
                <p className={styles.studentSub}>
                  ID <span className={styles.lrn}>{row.lrn}</span>
                </p>
              ) : null}
              <p className={styles.studentSub}>
                {row.section}
                {row.grade ? ` · ${row.grade}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report body — same position every row */}
      <div className={styles.body}>
        <h2 className={styles.reason}>{row.reason}</h2>

        {row.anecdotalExcerpt || row.anecdotalId ? (
          <div className={styles.block}>
            <p className={styles.blockLabel}>What was observed</p>
            {row.anecdotalExcerpt ? (
              <p className={styles.blockText}>
                {row.anecdotalExcerpt}
              </p>
            ) : null}
            {row.anecdotalId ? (
              <button
                type="button"
                className={styles.folderBtn}
                onClick={() =>
                  isClosed
                    ? onPrivacy(row.student)
                    : isEndorsedRow
                      ? onEndorsedNotice(row.student)
                      : onPreview(row.anecdotalId)
                }
                aria-label={
                  isClosed
                    ? `Report for ${row.student} is kept private because the case is finished`
                    : isEndorsedRow
                      ? `Report for ${row.student} moved with the case to the ADM coordinator`
                      : `Open the official anecdotal report for ${row.student}`
                }
              >
                <FolderCard
                  label="Anecdotal report"
                  sublabel={`${formatStatus(row.category)} · ${formatDate(row.date)}`}
                  files={[
                    {
                      name: `OCForm-01_${row.date}`,
                      tag: `${formatStatus(row.category)} • ${timeAgo(row.date)}`,
                      icon: "doc",
                    },
                  ]}
                />
              </button>
            ) : null}
          </div>
        ) : null}

        {row.intakeNotes ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>First impressions: </span>
            {row.intakeNotes}
          </p>
        ) : null}

        {/* Counseling plan — shared card (nurse design): status badge,
            then the live timer, then the title on every session row. */}
        {!isPending || (isAdmTrack && row.sessions.length > 0) ? (
          <SessionPlanCard
            title="Counseling sessions"
            sessions={row.sessions.map((s) => ({
              ...s,
              attachmentsCount: s.attachments?.length ?? 0,
            }))}
            now={now}
            closed={isClosed}
            closedHint="This case is closed — the sessions below are kept as history and can't be changed."
            emptyHint={
              <>No sessions yet — schedule the first talk with{" "}{row.student.split(" ")[0]}.</>
            }
            kindLabel={sessionTypeLabel}
            docsSupported
            gateOnStart
            manageable={canManageSessions}
            disabled={actionPending}
            onAction={(s, action) => {
              if (action === "docs") {
                setDocsFor(s);
                return;
              }
              onOpenSession(
                row.id,
                s,
                action === "cancel"
                  ? "cancelSess"
                  : action === "delete"
                    ? "deleteSess"
                    : action
              );
            }}
          />
        ) : null}

        {row.followUpDate ? (
          <p className={styles.callout}>
            Reminder: check back on{" "}
            <time dateTime={row.followUpDate}>
              {formatDate(row.followUpDate)}
            </time>
            .
          </p>
        ) : null}
        {row.escalationReason ? (
          <p className={styles.callout}>
            Sent up{row.escalatedTo ? ` to ${roleLabel(row.escalatedTo)}` : ""}:{" "}
            {row.escalationReason}
          </p>
        ) : null}
        {row.notes && !isAdmTrack ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>Internal note: </span>
            {row.notes}
          </p>
        ) : null}
        {row.resolutionSummary ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>How this ended: </span>
            {row.resolutionSummary}
          </p>
        ) : null}

        {/* Cases needing review (pending ADM) move through Review only —
            same as the nurse desk: just the Review ADM case button. */}
        <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
          {isAdmTrack && isPending ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              style={{ height: "32px" }}
              disabled={actionPending}
              onClick={() => onReviewAdm(row)}
            >
              Review ADM case
            </Button>
          ) : (
            <>
              {row.anecdotalId && (
                isEndorsedRow ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    style={{ height: "32px" }}
                    disabled={actionPending || gcLoading}
                    onClick={() => void openGcForm()}
                    aria-label={`View the GCForm-03 referral form for ${row.student}`}
                  >
                    {gcLoading ? (
                      <Loader2 className="animate-spin" aria-hidden style={{ width: "1rem", height: "1rem" }} />
                    ) : null}
                    {gcLoading ? "Loading…" : "View referral form"}
                  </Button>
                ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  onClick={() =>
                    isClosed
                      ? onPrivacy(row.student)
                      : onPreview(row.anecdotalId)
                  }
                  aria-label={
                    isClosed
                      ? `Referral for ${row.student} is kept private because the case is finished`
                      : `View the referral form for ${row.student}`
                  }
                >
                  View referral form
                </Button>
                )
              )}
              {!isClosed && !isAdmTrack && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  disabled={actionPending || booked}
                  title={
                    booked
                      ? "Finish or cancel the existing session before booking another one"
                      : `Book a session for ${row.student}`
                  }
                  onClick={() => onOpenDialog(row.id, "schedule")}
                >
                  Book session
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
    {docsFor && (
      <SessionDocsDialog
        referralId={row.id}
        session={docsFor}
        open
        onClose={() => setDocsFor(null)}
        onChanged={onChanged}
      />
    )}
    {/* Endorsed GCForm-03 viewer — read-only; the filled form lives with
        the ADM coordinator, rebuilt here from the case + its OCForm-01. */}
    {gcOpen && gcData && (
      <GcForm03PreviewDialog
        open
        data={gcData}
        confirming={false}
        onClose={() => setGcOpen(false)}
        onConfirm={() => {}}
        viewOnly
      />
    )}
    </>
  );
}
