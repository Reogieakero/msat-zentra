"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import type {
  NurseQueueRow,
  NurseReferralDraft,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import {
  activeSessionOf,
  formatActionTime,
  formatCountdown,
  formatDate,
  formatTime,
  hasScheduledSession,
  initials,
  isSessionStarted,
  latestActionOf,
  rowStatusHelp,
  rowStatusLabel,
  sessionKindLabel,
  statusVariant,
  timeAgo,
} from "./nurse-referrals-format";
import styles from "./NurseReferralEntry.module.css";

export type SessionDialogKind = "finish" | "move" | "cancel" | "delete";

/* Live countdown to the next scheduled session, with seconds. Once the
   time arrives it flips to a steady "Ongoing" state. */
function ClinicSessionsCountdown({
  sessions,
  now,
}: {
  sessions: NurseSessionItem[];
  now: number;
}) {
  const next = activeSessionOf(sessions);
  if (!next) return null;
  const at = new Date(next.scheduledAt).getTime();
  if (!Number.isFinite(at)) return null;
  const started = at <= now;
  return (
    <span
      className={styles.countdown}
      role="timer"
      aria-live="off"
      aria-label={
        started
          ? `Session started at ${formatTime(next.scheduledAt)} — you can now mark it done and file documentation`
          : `Session starts in ${formatCountdown(at, now)}`
      }
      title={
        started
          ? "Session time arrived — Mark done and docs are now unlocked"
          : `Starts ${formatDate(next.date)} at ${formatTime(next.scheduledAt)}`
      }
    >
      <span className={styles.countdownDot} aria-hidden="true" />
      {started ? (
        <>Ongoing — time arrived</>
      ) : (
        <>Starts in {formatCountdown(at, now)}</>
      )}
    </span>
  );
}

export function NurseReferralEntry({
  alert,
  alt,
  now,
  onPreview,
  onPrivacy,
  onSession,
  onDocs,
  onBook,
  onCreateReferral,
  onViewForm,
  onChanged,
}: {
  alert: NurseAlertItem;
  alt: boolean;
  now: number;
  onPreview: (recordId: string) => void;
  onPrivacy: (studentName: string) => void;
  onSession: (row: NurseQueueRow, session: NurseSessionItem, kind: SessionDialogKind) => void;
  onDocs: (row: NurseQueueRow, session: NurseSessionItem) => void;
  onBook: (row: NurseQueueRow) => void;
  onCreateReferral: (row: NurseQueueRow, draft: NurseReferralDraft) => void;
  onViewForm: (row: NurseQueueRow) => void;
  onChanged: () => void;
}) {
  const row = alert.row;
  const isAdm = row.type === "ADM";
  const isPending = row.status === "pending";
  const isClosed = row.status === "resolved" || row.status === "dismissed";
  // Clinic sessions run on clinic matters, plus pre-confirm bookings
  // on pending ADM consultations (booked from review without
  // deciding). Endorsed ADM sessions stay read-only history.
  const canManageSessions = !isAdm || (isAdm && row.status === "pending");
  const incident = row.anecdotal?.incident?.trim() || "";
  const latest = latestActionOf(row, alert);

  return (
    <li
      className={`${styles.entry}${alt ? ` ${styles.entryAlt}` : ""}`}
    >
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
                    : onPreview(row.anecdotalId as string)
                }
                aria-label={
                  isClosed
                    ? `Report for ${row.student} is kept private because the case is finished`
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

        {row.anecdotal && row.anecdotal.location !== "—" ? (
          <dl className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <dt>Where it happened</dt>
              <dd>{row.anecdotal.location}</dd>
            </div>
          </dl>
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

        {/* Clinic sessions — the real work on an accepted case.
            ADM consultations move through review instead: a prompt
            while pending (plus any sessions booked early, which stay
            manageable until the case is confirmed) and read-only
            history afterwards. */}
        {isPending && isAdm ? (
          <p className={styles.planHint}>
            Review this ADM consultation, fill the referral form, then
            confirm — confirming endorses it to the ADM coordinator
            at once. Or reject it. You can also book a clinic
            session first without deciding.
          </p>
        ) : null}
        {!isPending || (isAdm && row.sessions.length > 0) ? (
          <div className={styles.plan}>
            <div className={styles.planHead}>
              <p className={styles.blockLabel}>Clinic sessions</p>
              <span className={styles.planHeadRight}>
                <ClinicSessionsCountdown sessions={row.sessions} now={now} />
              </span>
            </div>
            {isClosed ? (
              <p className={styles.planEmpty}>
                This case is closed — the sessions below are kept as
                history and can&apos;t be changed.
              </p>
            ) : null}
            {row.sessions.length === 0 ? (
              <p className={styles.planEmpty}>
                No clinic sessions booked on this case.
              </p>
            ) : (
              <ul className={styles.sessionList}>
                {row.sessions.map((s) => {
                  const isScheduled = s.status === "scheduled";
                  const started = isSessionStarted(s.scheduledAt, now);
                  const locked = isScheduled && !started;
                  const targetMs = new Date(s.scheduledAt).getTime();
                  return (
                  <li key={s.id} className={styles.session}>
                    <div className={styles.sessionTop}>
                      <Badge
                        variant={
                          s.status === "completed"
                            ? "success"
                            : s.status === "cancelled"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {s.status === "completed"
                          ? "Done"
                          : s.status === "cancelled"
                            ? "Cancelled"
                            : "Upcoming"}
                      </Badge>
                      <p className={styles.sessionTitle}>
                        {sessionKindLabel(s.sessionType)}
                      </p>
                    </div>
                    <ul className={styles.sessionFacts}>
                      <li>
                        <time dateTime={s.scheduledAt}>
                          {formatDate(s.date)}
                        </time>
                      </li>
                      <li>{formatTime(s.scheduledAt)}</li>
                      {s.venue ? <li>{s.venue}</li> : null}
                    </ul>
                    {locked && Number.isFinite(targetMs) ? (
                      <p className={styles.sessionCountdown} role="timer" aria-label={`Session starts in ${formatCountdown(targetMs, now)}`}>
                        Starts in {formatCountdown(targetMs, now)} — Mark done and docs unlock at session time.
                      </p>
                    ) : null}
                    {s.status === "completed" && s.sessionNotes ? (
                      <p className={styles.sessionNotes}>
                        {s.sessionNotes}
                      </p>
                    ) : null}
                    {s.status === "completed" && s.outcome ? (
                      <p className={styles.sessionOutcome}>
                        <span className={styles.calloutPrefix}>
                          Outcome:{" "}
                        </span>
                        {s.outcome}
                      </p>
                    ) : null}
                    {s.status === "cancelled" && s.cancelReason ? (
                      <p className={styles.sessionOutcome}>
                        {s.cancelReason}
                      </p>
                    ) : null}
                    {(s.attachments?.length ?? 0) > 0 ? (
                      <p className={styles.sessionOutcome}>
                        <span className={styles.calloutPrefix}>
                          Docs:{" "}
                        </span>
                        {s.attachments.length} photo{s.attachments.length === 1 ? "" : "s"} filed
                        {" — "}
                        <button
                          type="button"
                          className={styles.folderBtn}
                          style={{ display: "inline" }}
                          onClick={() => onDocs(row, s)}
                          aria-label={`View documentation for the ${formatDate(s.date)} session`}
                        >
                          view
                        </button>
                      </p>
                    ) : null}
                    {!isClosed && canManageSessions && s.status !== "cancelled" ? (
                      <div
                        className={styles.sessionActions}
                        style={{ justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          style={{ height: "32px" }}
                          disabled={locked}
                          title={
                            locked
                              ? "Documentation unlocks once the session time arrives"
                              : s.status === "completed"
                                ? "View or file documentation for this session"
                                : "File documentation for this session"
                          }
                          onClick={() => onDocs(row, s)}
                        >
                          {(s.attachments?.length ?? 0) > 0 ? "Docs" : "Add docs (optional)"}
                        </Button>
                        {s.status === "scheduled" ? (
                          <span style={{ display: "inline-flex", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <Button
                              type="button"
                              size="xs"
                              style={{ height: "32px" }}
                              disabled={locked}
                              title={
                                locked
                                  ? "You can mark this session done once the scheduled time arrives"
                                  : "Record what happened and mark this session done"
                              }
                              onClick={() => onSession(row, s, "finish")}
                            >
                              Mark done
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              style={{ height: "32px" }}
                              onClick={() => onSession(row, s, "move")}
                            >
                              Move
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              style={{ height: "32px", backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                              onClick={() => onSession(row, s, "cancel")}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {!isClosed && s.status === "cancelled" ? (
                      <div
                        className={styles.sessionActions}
                        style={{ justifyContent: "flex-end", alignItems: "center" }}
                      >
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          className={styles.deleteBtn}
                          style={{ height: "32px", backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff", opacity: 1 }}
                          title="Permanently remove this cancelled session"
                          onClick={() => onSession(row, s, "delete")}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
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
              {/* Clinic flow: view → book → done → docs. No endorse,
                  no start-handling / finish-close buttons. */}
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
                      : `View the referral for ${row.student}`
                  }
                >
                  View referral
                </Button>
              )}
              {!isClosed && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  style={{ height: "32px" }}
                  disabled={hasScheduledSession(row.sessions)}
                  title={
                    hasScheduledSession(row.sessions)
                      ? "Finish or cancel the existing session before booking another one"
                      : `Book a clinic session for ${row.student}`
                  }
                  onClick={() => onBook(row)}
                >
                  Book session
                </Button>
              )}
            </>
          )}
          <NurseQueueRowActions
            row={row}
            onChanged={onChanged}
            hiddenItems={["start", "resolve"]}
          />
        </div>
        {/* Clinic steps live under the actions menu. */}
        {isPending && !isAdm ? (
          <p className={styles.planHint}>
            View the referral, book a clinic session below, mark it
            done once it happens, then file photos/notes from the
            session list.
          </p>
        ) : null}
      </div>
    </li>
  );
}
