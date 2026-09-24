"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  friendlyWords,
  formatManilaDate,
  formatManilaTime,
  stageLabel,
  eligibilityLabel,
  venueLabel,
  type AdmCaseRow,
  type AdmMeeting,
} from "../../components/coordinator-data";
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
  onOutcome: (m: AdmMeeting) => void;
  onAdvance: (row: AdmCaseRow) => void;
  onForward: (row: AdmCaseRow) => void;
  onPrepareCreate: (row: AdmCaseRow) => void;
  prepareCreatePending: boolean;
  /** Row id currently being booked/rescheduled — disables its button only. */
  bookPendingId: string | null;
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
            <div>
              <p className={styles.sheetSectionTitle}>Student</p>
              <p className={styles.studentName}>{selected.student}</p>
              <p className={`${styles.studentSub} ${styles.mono}`}>
                {selected.lrn} · {selected.grade}
              </p>
              <p className={styles.studentSub}>
                Stage: {stageLabel(selected.stage)} ·{" "}
                {eligibilityLabel(selected.eligibilityStatus)}
              </p>
            </div>
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
              {!isProfile ? (
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
                          ? pendingMeeting
                            ? "Rescheduling…"
                            : "Booking…"
                          : pendingMeeting
                            ? "Reschedule meeting"
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
                  {meetings.map((m) => (
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
                        </div>
                        <p
                          className={styles.studentSub}
                          style={{ margin: "0.25rem 0 0" }}
                        >
                          {formatManilaDate(m.meetingDatetime)} ·{" "}
                          {formatManilaTime(m.meetingDatetime)} · booked by{" "}
                          {m.recordedBy}
                        </p>
                        {m.minutesOfMeeting ? (
                          <p
                            className={styles.studentSub}
                            style={{ margin: "0.25rem 0 0" }}
                          >
                            {m.minutesOfMeeting}
                          </p>
                        ) : null}
                      </div>
                      {!m.attended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOutcome(m)}
                        >
                          Record outcome
                        </Button>
                      ) : null}
                    </li>
                  ))}
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
              ) : null}
            </div>
            <div>
              <p className={styles.sheetSectionTitle}>Referral</p>
              <p className={styles.studentSub} style={{ margin: 0 }}>
                Referred by {selected.preparedBy}
                {(selected.endorsedAt
                  ? ` · endorsed ${selected.endorsedAt.slice(0, 10)}`
                  : selected.datePrepared
                    ? ` · ${selected.datePrepared}`
                    : "")}
              </p>
              {selected.approvedBy ? (
                <p className={styles.studentSub} style={{ margin: 0 }}>
                  Approved by {selected.approvedBy}
                  {selected.approvalDate ? ` · ${selected.approvalDate}` : ""}
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
