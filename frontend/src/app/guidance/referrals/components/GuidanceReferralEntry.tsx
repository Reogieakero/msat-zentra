"use client";

import * as React from "react";
import { CalendarClock, ChevronRight, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import {
  buildGcForm03Data,
  consultRecommendation,
} from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import { GcForm03PreviewDialog } from "../../adm/components/GcForm03PreviewDialog";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import {
  anecdotalCategoryColor,
  formatDate,
  formatStatus,
  initials,
  roleLabel,
  rowStatusHelp,
  rowStatusLabel,
  statusVariant,
  timeAgo,
  watermarkLabel,
  watermarkColor,
} from "./guidance-referrals-format";
import { latestActionDay, latestSentence, observedSentence, useGuidanceEntryMeta } from "./use-guidance-entry-meta";
import { GuidanceEntryDocsHost } from "./guidance-entry-docs-host";
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

export function GuidanceReferralEntry({
  row,
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
  const { isPending, isClosed, isAdmTrack, hasRail, isEndorsedRow, canManageSessions, latest, booked } = useGuidanceEntryMeta(row);

  const [docsFor, setDocsFor] = React.useState<CounselingSessionItem | null>(null);

  const [sessOpen, setSessOpen] = React.useState(false);

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
    <li id={`guidance-case-${row.id}`} className={`${styles.entry}${highlighted ? ` ${styles.entryHighlight}` : ""}`}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <span className={`${styles.watermark} ${styles["watermark" + watermarkColor(row).replace(/^./, c => c.toUpperCase())]}`} aria-hidden="true">
        {watermarkLabel(row)}
      </span>

      <div className={`relative ${styles.hGrid}${hasRail ? "" : ` ${styles.hGridNoRail}`}`}>
        <div className={styles.idCol}>
          <div className={styles.idTop}>
            <Avatar className={styles.avatar} aria-hidden="true">
              <AvatarFallback>{initials(row.student)}</AvatarFallback>
            </Avatar>
            <div className={styles.studentText}>
              <p className={styles.studentName}>{row.student}</p>
              <p className={styles.studentSub}>
                {row.section}
                {row.grade ? ` · ${row.grade}` : ""}
                {row.lrn ? (
                  <>
                    {" · "}ID <span className={styles.lrn}>{row.lrn}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className={styles.railBadges}>
            <Badge variant={statusVariant(row.status, row.type, row)}>
              {rowStatusLabel(row.type, row.status, row)}
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
          <p className={styles.railMeta}>Sent by {row.referredBy}</p>
          <p className={styles.railMeta}>{observedSentence(row)}</p>
          <p className={styles.railMeta}>{latestSentence(latest)}</p>
        </div>
        <div className={styles.body}>
        {rowStatusHelp(row.type, row.status, row) ? (
          <p className={styles.statusHelp}>
            {rowStatusHelp(row.type, row.status, row)}
          </p>
        ) : null}
        <h2 className={styles.reason}>{row.reason}</h2>

        {row.anecdotalExcerpt ? (
          <div className={styles.block}>
            <p className={styles.blockLabel}>What was observed</p>
            <p className={styles.blockText}>
              {row.anecdotalExcerpt}
            </p>
          </div>
        ) : null}

        {row.intakeNotes ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>First impressions: </span>
            {row.intakeNotes}
          </p>
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

        <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
          {isAdmTrack && isPending ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              style={{ height: "32px" }}
              disabled={actionPending}
              aria-busy={actionPending || undefined}
              onClick={() => onReviewAdm(row)}
            >
              {actionPending ? (
                <Loader2 className="animate-spin" aria-hidden style={{ width: "1rem", height: "1rem" }} />
              ) : null}
              {actionPending ? "Working…" : "Review ADM case"}
            </Button>
          ) : (
            <>
              {row.anecdotalId && (
                isEndorsedRow ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="default"
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
                  variant={isAdmTrack ? "default" : "outline"}
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
                  variant="default"
                  style={{ height: "32px" }}
                  disabled={actionPending || booked}
                  aria-busy={actionPending || undefined}
                  title={
                    booked
                      ? "Finish or cancel the existing session before booking another one"
                      : `Book a session for ${row.student}`
                  }
                  onClick={() => onOpenDialog(row.id, "schedule")}
                >
                  {actionPending ? (
                    <Loader2 className="animate-spin" aria-hidden style={{ width: "1rem", height: "1rem" }} />
                  ) : null}
                  {actionPending ? "Working…" : "Book session"}
                </Button>
              )}
            </>
          )}
        </div>
        </div>
        {hasRail ? (
          <aside
            className={styles.sideRail}
            aria-label={`Report and sessions for ${row.student}`}
          >
            {row.anecdotalId ? (
              <button
                type="button"
                className={styles.folderBtn}
                onClick={() =>
                  isClosed
                    ? onPrivacy(row.student)
                    : isEndorsedRow
                      ? onEndorsedNotice(row.student)
                      : onPreview(row.anecdotalId as string)
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
                  folderColor={anecdotalCategoryColor(row.category)}
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
            {row.sessions.length > 0 ? (
              <div className={styles.sessRailBlock}>

                <button
                  type="button"
                  className={styles.sessDrop}
                  aria-haspopup="dialog"
                  aria-label={`Counseling sessions for ${row.student}, ${row.sessions.length} ${row.sessions.length === 1 ? "session" : "sessions"} — click to view`}
                  onClick={() => setSessOpen(true)}
                >
                  <span className={styles.sessDropIcon} aria-hidden="true">
                    <CalendarClock size={18} />
                  </span>
                  <span className={styles.sessDropText}>
                    <span className={styles.sessDropTitle}>Counseling sessions</span>
                    <span className={styles.sessDropSub}>
                      {row.sessions.length} {row.sessions.length === 1 ? "session" : "sessions"} · click to view
                    </span>
                  </span>
                  <span className={styles.sessDropCount} aria-hidden="true">
                    {row.sessions.length}
                  </span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className={styles.sessChevron}
                  />
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </li>
    <GuidanceEntryDocsHost
      row={row}
      now={now}
      sessOpen={sessOpen}
      onSessOpenChange={setSessOpen}
      docsFor={docsFor}
      onDocs={setDocsFor}
      onDocsClose={() => setDocsFor(null)}
      onOpenSession={onOpenSession}
      actionPending={actionPending}
      onChanged={onChanged}
      isClosed={isClosed}
      canManageSessions={canManageSessions}
    />

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
