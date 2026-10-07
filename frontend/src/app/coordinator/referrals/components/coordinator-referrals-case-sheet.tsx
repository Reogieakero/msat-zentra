"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  friendlyWords,
  formatManilaDate,
  formatManilaDateLong,
  formatManilaTime,
  meetingInviteeLabel,
  stageLabel,
  eligibilityLabel,
  venueLabel,
} from "@/services/coordinator/labels";
import {
  uploadMeetingAttachments,
  deleteMeetingAttachment,
} from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmMeeting,
} from "@/services/coordinator/coordinator.types";
import {
  FORM_LABELS,
  FORM_DOT,
  isEarlyRow,
} from "./coordinator-referrals-constants";
import styles from "./coordinator-referrals-case-sheet.module.css";

interface CoordinatorReferralsCaseSheetProps {
  selected: AdmCaseRow | null;
  isProfile: boolean;
  meetings: AdmMeeting[];
  meetingsPending: boolean;
  meetingsError: boolean;
  onRetryMeetings: () => void;
  onClose: () => void;
  onBook: () => void;
  onOutcome: (m: AdmMeeting, row: AdmCaseRow | null) => void;
  onAdvance: (row: AdmCaseRow) => void;
  onForward: (row: AdmCaseRow) => void;
  onPrepareCreate: (row: AdmCaseRow) => void;
  prepareCreatePending: boolean;
  /** Row id currently being booked/rescheduled — disables its button only. */
  bookPendingId: string | null;
  /** Page clock for live/overdue meeting chips. */
  now: number;
}

/* Live-state thresholds shared with the full case file card: a meeting
   opens 15 min early and stays live 60 min after its start. */
const JOIN_EARLY_MS = 15 * 60_000;
const MEETING_LEN_MS = 60 * 60_000;

function liveChip(
  m: Pick<AdmMeeting, "meetingDatetime" | "attended">,
  now: number,
): "live" | "overdue" | null {
  if (m.attended) return null;
  const start = new Date(m.meetingDatetime).getTime();
  if (!Number.isFinite(start)) return null;
  if (now < start - JOIN_EARLY_MS) return null;
  return now <= start + MEETING_LEN_MS ? "live" : "overdue";
}

/* Per-meeting documentation in the sheet: persisted thumbs with remove,
   plus an image picker + upload. Refreshes the meetings list on change. */
function MeetingDocsRow({
  meeting,
  onRefresh,
}: {
  meeting: Pick<AdmMeeting, "id" | "attachments">;
  onRefresh: () => void;
}) {
  const [picked, setPicked] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const docs = meeting.attachments ?? [];

  function pick(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (next.length === 0) {
      setError("Pick JPG, PNG, or WEBP images.");
      return;
    }
    setError(null);
    setPicked((prev) => [...prev, ...next].slice(0, 10));
  }

  async function upload() {
    if (picked.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMeetingAttachments(meeting.id, picked);
      setPicked([]);
      if (inputRef.current) inputRef.current.value = "";
      onRefresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    setError(null);
    try {
      await deleteMeetingAttachment(meeting.id, id);
      onRefresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div style={{ marginTop: "0.375rem" }}>
      {docs.length > 0 ? (
        <ul className={styles.evidenceList}>
          {docs.map((d) => (
            <li key={d.id} className={styles.evidenceItem}>
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.studentSub}
                style={{ margin: 0, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={d.fileName}
              >
                {d.fileName}
              </a>
              <Button
                size="sm"
                variant="ghost"
                disabled={removingId === d.id}
                aria-busy={removingId === d.id || undefined}
                aria-label={`Remove ${d.fileName}`}
                onClick={() => void remove(d.id)}
              >
                {removingId === d.id ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Attach meeting documents"
          onChange={(e) => pick(e.target.files)}
          style={{ flex: 1, minWidth: "10rem" }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading || picked.length === 0}
          aria-busy={uploading || undefined}
          onClick={() => void upload()}
        >
          {uploading ? "Uploading…" : `Attach${picked.length > 0 ? ` (${picked.length})` : ""}`}
        </Button>
      </div>
      {error ? (
        <p className={styles.note} role="alert" style={{ margin: "0.25rem 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CoordinatorReferralsCaseSheet({
  selected,
  isProfile,
  meetings,
  meetingsPending,
  meetingsError,
  onRetryMeetings,
  onClose,
  onBook,
  onOutcome,
  onAdvance,
  onForward,
  onPrepareCreate,
  prepareCreatePending,
  bookPendingId,
  now,
}: CoordinatorReferralsCaseSheetProps) {
  // A still-booked (unattended) meeting blocks a second booking — the
  // action reschedules it instead. Profile cases read the live meetings
  // list; early referral rows fall back to the row's latest-meeting
  // snapshot.
  const pendingMeeting = isProfile
    ? (meetings.find((m) => !m.attended) ?? null)
    : selected?.meeting && !selected.meeting.attended
      ? selected.meeting
      : null;
  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent style={{ width: "min(34rem, 100%)", overflowY: "auto" }}>
        <SheetHeader>
          <SheetTitle>ADM case file</SheetTitle>
          <SheetDescription>
            Evidence review. Eligibility is derived from the checklist below — it
            cannot be typed manually.
          </SheetDescription>
        </SheetHeader>
        {selected ? (
          <div className={styles.sheetBody}>
            <Card className={styles.infoCard}>
              <span className={styles.glowClip} aria-hidden="true">
                <span className={styles.cardGlow} />
              </span>
              <CardHeader>
                <p className={styles.sheetSectionTitle}>Student</p>
              </CardHeader>
              <CardContent>
                <p className={styles.studentName}>{selected.student}</p>
                <p className={`${styles.studentSub} ${styles.mono}`}>
                  {selected.lrn} · {selected.grade}
                </p>
                <p className={styles.studentSub}>
                  Stage: {stageLabel(selected.stage)} ·{" "}
                  {eligibilityLabel(selected.eligibilityStatus)}
                </p>
              </CardContent>
            </Card>
            <div>
              <p className={styles.sheetSectionTitle}>Evidence chain</p>
              {selected.forms.length === 0 ? (
                <p className={styles.note}>
                  {isEarlyRow(selected)
                    ? "No learner profile yet — create one to start collecting evidence."
                    : "No forms recorded yet."}
                </p>
              ) : (
                <ul className={styles.evidenceList}>
                  {selected.forms.map((f) => (
                    <li key={f.id} className={styles.evidenceItem}>
                      <span
                        className={styles.evidenceDot}
                        style={{
                          backgroundColor: FORM_DOT[f.status] ?? "#d4d4d4",
                        }}
                        aria-hidden
                      />
                      <span>
                        {FORM_LABELS[f.formType] ?? friendlyWords(f.formType)}
                      </span>
                      <Badge variant="outline">{friendlyWords(f.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className={styles.sheetSectionTitle}>Parent meetings</p>
              {!isProfile &&
              meetings.length === 0 &&
              !meetingsPending &&
              !meetingsError ? (
                <>
                  <p className={styles.note}>
                    No learner profile yet — you can still book the parent
                    meeting now, or create the profile first to start
                    collecting evidence.
                  </p>
                  {selected ? (
                    <div className={styles.sheetActions}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bookPendingId === selected.id}
                        aria-busy={
                          bookPendingId === selected.id || undefined
                        }
                        onClick={onBook}
                      >
                        {bookPendingId === selected.id ? (
                          <Loader2
                            className={styles.spin}
                            aria-hidden="true"
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        ) : null}
                        {bookPendingId === selected.id
                          ? "Booking…"
                          : "Book meeting"}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : meetingsPending ? (
                <div aria-busy="true" aria-label="Loading meetings">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className={styles.meetingSkel}
                      aria-hidden="true"
                    >
                      <div className={styles.badgeRow}>
                        <Skeleton
                          style={{
                            width: "5rem",
                            height: "1.375rem",
                            borderRadius: "999px",
                          }}
                        />
                        <Skeleton
                          style={{
                            width: "4rem",
                            height: "1.375rem",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                      <Skeleton
                        style={{
                          width: "85%",
                          height: "0.75rem",
                          marginTop: "0.375rem",
                        }}
                      />
                      <Skeleton
                        style={{
                          width: "60%",
                          height: "0.75rem",
                          marginTop: "0.25rem",
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : meetingsError ? (
                <p className={styles.note}>
                  Couldn&apos;t load meetings.{" "}
                  <Button variant="link" size="sm" onClick={onRetryMeetings}>
                    Try again
                  </Button>
                </p>
              ) : meetings.length === 0 ? (
                <p className={styles.note}>
                  No meeting booked yet — schedule one in school or as a home
                  visitation.
                </p>
              ) : (
                <ul className={styles.evidenceList}>
                  {meetings.map((m) => {
                    const live = liveChip(m, now);
                    const invited = m.invitees ?? [];
                    return (
                      <li
                        key={m.id}
                        className={styles.evidenceItem}
                        style={{ alignItems: "flex-start" }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className={styles.badgeRow}>
                            <Badge
                              variant={m.venue === "home" ? "secondary" : "outline"}
                            >
                              {venueLabel(m.venue)}
                            </Badge>
                            <Badge variant={m.attended ? "success" : "outline"}>
                              {m.attended ? "Attended" : "Booked"}
                            </Badge>
                            {live === "live" ? (
                              <Badge variant="success">Live now</Badge>
                            ) : live === "overdue" ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : null}
                          </div>
                          <p
                            className={styles.studentSub}
                            style={{ margin: "0.25rem 0 0" }}
                          >
                            {formatManilaDate(m.meetingDatetime)} ·{" "}
                            {formatManilaTime(m.meetingDatetime)} · booked by{" "}
                            {m.recordedBy}
                          </p>
                          {invited.length > 0 ? (
                            <p
                              className={styles.studentSub}
                              style={{ margin: "0.25rem 0 0" }}
                            >
                              Invited: {invited.map(meetingInviteeLabel).join("; ")}
                            </p>
                          ) : null}
                          {m.minutesOfMeeting ? (
                            <p
                              className={styles.studentSub}
                              style={{ margin: "0.25rem 0 0" }}
                            >
                              {m.minutesOfMeeting}
                            </p>
                          ) : null}
                          <MeetingDocsRow meeting={m} onRefresh={onRetryMeetings} />
                        </div>
                        {!m.attended ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOutcome(m, selected)}
                          >
                            Record outcome
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {isProfile ? (
                <div className={styles.sheetActions}>
                  <Button size="sm" variant="outline" onClick={onBook}>
                    {pendingMeeting ? "Reschedule meeting" : "Book meeting"}
                  </Button>
                  {pendingMeeting ? (
                    <p className={styles.note} style={{ margin: 0 }}>
                      Already booked — reschedule instead of booking another
                      one.
                    </p>
                  ) : null}
                </div>
              ) : !meetingsPending &&
                !meetingsError &&
                meetings.length > 0 ? (
                // Early row with a booked meeting: the row menu reschedules
                // it, and so does this button (the hook resolves the live
                // meeting either way).
                <div className={styles.sheetActions}>
                  <Button size="sm" variant="outline" onClick={onBook}>
                    {meetings.some((m) => !m.attended)
                      ? "Reschedule meeting"
                      : "Book meeting"}
                  </Button>
                  {meetings.some((m) => !m.attended) ? (
                    <p className={styles.note} style={{ margin: 0 }}>
                      Already booked — reschedule instead of booking another
                      one.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {/* Attended meeting recorded: hand the case to the full file's
                  recommendation + certification fill-up. */}
              {isProfile &&
              (selected.stage === "meeting_parents" ||
                selected.stage === "home_visitation") &&
              meetings.some((m) => m.attended) ? (
                <div className={styles.sheetActions}>
                  <Button size="sm" asChild>
                    <Link
                      href={`/coordinator/referrals/${encodeURIComponent(selected.id)}?certify=1`}
                    >
                      Continue to certification
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <p className={styles.sheetSectionTitle}>Referral</p>
              <p className={styles.studentSub} style={{ margin: 0 }}>
                Referred by {selected.preparedBy}
                {(selected.endorsedAt
                  ? ` · endorsed ${formatManilaDateLong(selected.endorsedAt)}`
                  : selected.datePrepared
                    ? ` · ${formatManilaDateLong(selected.datePrepared)}`
                    : "")}
              </p>
              {selected.approvedBy ? (
                <p className={styles.studentSub} style={{ margin: 0 }}>
                  Approved by {selected.approvedBy}
                  {selected.approvalDate ? ` · ${formatManilaDateLong(selected.approvalDate)}` : ""}
                </p>
              ) : null}
            </div>
            <div className={styles.sheetActions}>
              {isEarlyRow(selected) ? (
                <Button
                  size="sm"
                  disabled={prepareCreatePending}
                  aria-busy={prepareCreatePending || undefined}
                  onClick={() => onPrepareCreate(selected)}
                >
                  {prepareCreatePending ? (
                    <Loader2
                      className={styles.spin}
                      aria-hidden="true"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                  ) : null}
                  {prepareCreatePending
                    ? "Preparing…"
                    : "Create learner profile"}
                </Button>
              ) : selected.stage === "consultation" ? (
                <Button size="sm" onClick={() => onAdvance(selected)}>
                  Advance to parent meeting
                </Button>
              ) : selected.stage === "certification" ? (
                <Button size="sm" onClick={() => onForward(selected)}>
                  Endorse to Principal
                </Button>
              ) : selected.stage === "principal_approval" &&
                !selected.approvedBy ? (
                <p className={styles.note} style={{ margin: 0 }}>
                  Forwarded and locked — awaiting the Principal&apos;s signature.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
