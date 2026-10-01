"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderCard } from "@/components/ui/FolderCard";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import {
  anecdotalCategoryColor,
  formatDate,
  formatTime,
  hasScheduledSession,
  initials,
  isEndorsed,
  latestActionOf,
  rowStatusHelp,
  rowStatusLabel,
  sessionKindLabel,
  statusVariant,
  timeAgo,
  watermarkColor,
  watermarkLabel,
} from "./nurse-referrals-format";
import { SessionPlanCard } from "@/components/session-plan/SessionPlanCard";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./NurseReferralEntry.module.css";

export type SessionDialogKind = "finish" | "move" | "cancel" | "delete";

/* Sentence-form timing lines (no dot separators), e.g.
   "Referred today, Sep 29, 2026." and
   "Latest update was needs review on Sep 29, 2026 at 7:57 PM." */
function referredSentence(row: NurseQueueRow): string {
  if (!row.date || row.date === "—") return "Referral date is not recorded.";
  const date = formatDate(row.date);
  const days = row.waitingDays;
  if (days === null || days === undefined) return `Referred on ${date}.`;
  if (days <= 0) return `Referred today, ${date}.`;
  if (days === 1) return `Referred yesterday, ${date}.`;
  return `Referred ${days} days ago, ${date}.`;
}

function latestSentence(latest: { label: string; time: string }): string {
  const label = latest.label
    ? latest.label.charAt(0).toLowerCase() + latest.label.slice(1)
    : "an update";
  if (!latest.time || latest.time === "—")
    return `Latest update was ${label}.`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(latest.time))
    return `Latest update was ${label} on ${formatDate(latest.time)}.`;
  const d = new Date(latest.time);
  if (Number.isNaN(d.getTime())) return `Latest update was ${label}.`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `Latest update was ${label} on ${formatDate(localDay)} at ${formatTime(latest.time)}.`;
}

export function NurseReferralEntry({
  alert,
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
  // Clinic sessions open in an overlay modal from the rail strip —
  // never inline in the card. Starts closed; the strip shows the count.
  const showSessions = !isPending || (isAdm && row.sessions.length > 0);
  const hasRail = !!row.anecdotalId || showSessions;
  const [sessOpen, setSessOpen] = React.useState(false);

  return (
    <li
      id={`nurse-case-${row.id}`}
      className={`${assign.card}${highlighted ? ` ${styles.entryHighlight}` : ""}`}
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <span className={`${styles.watermark} ${styles["watermark" + watermarkColor(row).replace(/^./, (c) => c.toUpperCase())]}`} aria-hidden="true">
        {watermarkLabel(row)}
      </span>

      {/* Horizontal card — identity column left, report middle, rail right */}
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
                {row.grade && row.grade !== "—" ? ` · ${row.grade}` : ""}
                {row.lrn ? (
                  <>
                    {" · "}ID <span className={styles.lrn}>{row.lrn}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className={styles.railBadges}>
            <Badge variant={statusVariant(row.type, row.status, row)}>
              {rowStatusLabel(row.type, row.status, row)}
            </Badge>
            <Badge variant={isAdm ? "secondary" : "outline"}>
              {isAdm ? "ADM" : "Clinic"}
            </Badge>
            <Badge variant="outline">{row.category}</Badge>
          </div>
          <p className={styles.railMeta}>{referredSentence(row)}</p>
          <p className={styles.railMeta}>{latestSentence(latest)}</p>
        </div>
        <div className={styles.body}>
          {rowStatusHelp(row.type, row.status, row) ? (
            <p className={styles.statusHelp}>{rowStatusHelp(row.type, row.status, row)}</p>
          ) : null}
          <h2 className={styles.reason}>{row.reason}</h2>

          {incident ? (
            <div className={styles.block}>
              <p className={styles.blockLabel}>What was observed</p>
              <p className={styles.blockText}>{incident}</p>
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
        {/* Internal notes stay off ADM rows — the endorsement lives in
            the GCForm-03 referral form viewer, and the raw note carries
            internal `[ADM …]` encoding not meant for display. */}
        {row.notes && !isAdm ? (
          <p className={styles.calloutMuted}>
            <span className={styles.calloutPrefix}>Internal note: </span>
            {row.notes}
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
                  already auto-endorsed, so no forward button.
                  Shown for every ADM case (pending or endorsed, including
                  legacy endorsements without the ready flag) so the GCForm-03
                  matches the guidance ADM "See referral form" behavior. */}
              <Button
                type="button"
                size="xs"
                variant="default"
                style={{ height: "32px" }}
                onClick={() => onViewForm(row)}
              >
                View referral form
              </Button>
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
                  variant="default"
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
                  sublabel={`${row.category} · ${formatDate(row.date)}`}
                  folderColor={anecdotalCategoryColor(row.anecdotal?.category ?? row.category)}
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
            {showSessions ? (
              <div className={styles.sessRailBlock}>
                {/* Custom sessions opener — gradient strip, not a plain button
                    and not a folder. Opens the sessions as an overlay modal. */}
                <button
                  type="button"
                  className={styles.sessDrop}
                  aria-haspopup="dialog"
                  aria-label={`Clinic sessions for ${row.student}, ${row.sessions.length} ${row.sessions.length === 1 ? "session" : "sessions"} — click to view`}
                  onClick={() => setSessOpen(true)}
                >
                  <span className={styles.sessDropIcon} aria-hidden="true">
                    <CalendarClock size={18} />
                  </span>
                  <span className={styles.sessDropText}>
                    <span className={styles.sessDropTitle}>Clinic sessions</span>
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
                <Dialog open={sessOpen} onOpenChange={setSessOpen}>
                  <DialogContent
                    className={`${styles.modalCard} max-h-[85vh] overflow-y-auto sm:max-w-lg`}
                  >
                    <span className={assign.glowClip} aria-hidden="true">
                      <span className={assign.cardGlow} />
                    </span>
                    <DialogHeader className="relative">
                      <DialogTitle>Clinic sessions for {row.student}</DialogTitle>
                      <DialogDescription>
                        {row.sessions.length} {row.sessions.length === 1 ? "session" : "sessions"} on this case.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
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
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </li>
  );
}
