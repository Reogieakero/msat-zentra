"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import {
  formatActionTime,
  formatDate,
  hasScheduledSession,
  initials,
  isEndorsed,
  latestActionOf,
  rowStatusHelp,
  rowStatusLabel,
  sessionKindLabel,
  statusVariant,
  timeAgo,
  watermarkLabel,
  watermarkColor,
} from "./nurse-referrals-format";
import { SessionPlanCard } from "@/components/session-plan/SessionPlanCard";
import styles from "./NurseReferralEntry.module.css";

export type SessionDialogKind = "finish" | "move" | "cancel" | "delete";

export function NurseReferralEntry({
  alert,
  alt,
  highlighted = false,
  now,
  onPreview,
  onPrivacy,
  onEndorsedNotice,
  onSession,
  onDocs,
  onSchedule,
  onCreateReferral,
  onViewForm,
  onChanged,
}: {
  alert: NurseAlertItem;
  alt: boolean;
  highlighted?: boolean;
  now: number;
  onPreview: (recordId: string) => void;
  onPrivacy: (studentName: string) => void;
  onEndorsedNotice: (studentName: string) => void;
  onSession: (row: NurseQueueRow, session: NurseSessionItem, kind: SessionDialogKind) => void;
  onDocs: (row: NurseQueueRow, session: NurseSessionItem) => void;
  onSchedule: (row: NurseQueueRow) => void;
  onCreateReferral: (row: NurseQueueRow, draft: AdmReviewDraft) => void;
  onViewForm: (row: NurseQueueRow) => void;
  onChanged: () => void;
}) {
  const row = alert.row;
  const isAdm = row.type === "ADM";
  const isPending = row.status === "pending";
  const isClosed = row.status === "resolved" || row.status === "dismissed" || (row.completedSessions > 0 && !hasScheduledSession(row.sessions));
  // Endorsed ADM cases moved to the coordinator with their full report —
  // the anecdotal write-up is no longer viewable on this desk.
  const isEndorsedRow = isEndorsed(row.type, row.status);
  // Clinic sessions run on clinic matters, plus pre-confirm bookings
  // on pending ADM consultations (booked from review without
  // deciding). Endorsed ADM sessions stay read-only history.
  const canManageSessions = !isAdm || (isAdm && row.status === "pending");
  // One active session per case — booking waits while one is scheduled
  // (same rule as the guidance desk; the server enforces it too).
  const booked = hasScheduledSession(row.sessions);
  const incident = row.anecdotal?.incident?.trim() || "";
  const latest = latestActionOf(row, alert);

  return (
    <li
      id={`nurse-case-${row.id}`}
      className={`${styles.entry}${alt ? ` ${styles.entryAlt}` : ""}${highlighted ? ` ${styles.entryHighlight}` : ""}`}
    >
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
            <Badge variant={statusVariant(row.type, row.status)}>
              {rowStatusLabel(row.type, row.status)}
            </Badge>
            <Badge variant={isAdm ? "secondary" : "outline"}>
              {isAdm ? "ADM" : "Clinic"}
            </Badge>
            <Badge variant="outline">{row.category}</Badge>
          </div>
        </div>
        {rowStatusHelp(row.type, row.status) ? (
          <p className={styles.statusHelp}>{rowStatusHelp(row.type, row.status)}</p>
        ) : null}
        <p className={styles.railMeta}>{alert.waiting}</p>
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
                {row.grade && row.grade !== "—" ? ` · ${row.grade}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report body — same position every row */}
      <div className={styles.body}>
        <h2 className={styles.reason}>{row.reason}</h2>

        {incident || row.anecdotalId ? (
          <div className={styles.block}>
            <p className={styles.blockLabel}>What was observed</p>
            {incident ? (
              <p className={styles.blockText}>{incident}</p>
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
                  sublabel={`${row.category} · ${formatDate(row.date)}`}
                  files={[
                    {
                      name: `OCForm-01_${row.date}`,
                      tag: `${row.category} • ${timeAgo(row.date)}`,
                      icon: "doc",
                    },
                  ]}
                />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Clinic intake notes only — ADM consultations carry the
            endorsement in the internal note below, never here. */}
        {row.intakeNotes && !isAdm ? (
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
            Sent to the clinic: {row.escalationReason}
          </p>
        ) : null}
        {row.notes ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>Internal note: </span>
            {row.notes}
          </p>
        ) : null}

        {/* Clinic sessions — shared card (nurse design): status badge,
            then the live timer, then the title on every session row. */}
        {!isPending || (isAdm && row.sessions.length > 0) ? (
          <SessionPlanCard
            title="Clinic sessions"
            sessions={row.sessions.map((s) => ({
              ...s,
              attachmentsCount: s.attachments?.length ?? 0,
            }))}
            now={now}
            closed={isClosed}
            closedHint="This case is closed — the sessions below are kept as history and can't be changed."
            emptyHint="No clinic sessions booked on this case."
            kindLabel={sessionKindLabel}
            docsSupported
            gateOnStart
            manageable={canManageSessions}
            onAction={(s, action) =>
              action === "docs" ? onDocs(row, s) : onSession(row, s, action)
            }
          />
        ) : null}

        {isPending && !isAdm ? (
          <p className={styles.planHint}>
            Book a session below, mark it done once it happens,
            then file photos/notes from the session list.
          </p>
        ) : null}
        <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
          {isAdm ? (
            <>
              {isPending && (
                <NurseAdmReviewDialog
                  row={row}
                  onChanged={onChanged}
                  onCreateReferral={(draft) => onCreateReferral(row, draft)}
                />
              )}
              {/* The filled template is view-only — confirming
                  already auto-endorsed, so no forward button. */}
              {row.referralReady && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  onClick={() => onViewForm(row)}
                >
                  View referral form
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Clinic flow: view → book → done → docs. Same Book session
                  button as the guidance desk; one active session at a time. */}
              {row.anecdotalId && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  onClick={() =>
                    isClosed
                      ? onPrivacy(row.student)
                      : onPreview(row.anecdotalId as string)
                  }
                  aria-label={
                    isClosed
                      ? `Referral for ${row.student} is kept private because the case is finished`
                      : `View the referral form for ${row.student}`
                  }
                >
                  View referral form
                </Button>
              )}
              {!isClosed && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  disabled={booked}
                  title={
                    booked
                      ? "Finish or cancel the existing session before booking another one"
                      : `Book a clinic session for ${row.student}`
                  }
                  onClick={() => onSchedule(row)}
                >
                  Book session
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
