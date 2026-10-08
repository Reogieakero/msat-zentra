"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import {
  attendeeLabel,
  formatManilaDate,
  formatManilaTime,
  meetingInviteeLabel,
  venueLabel,
} from "@/services/coordinator/labels";
import styles from "../case-page.module.css";
import type {
  ParentMeetingItem,
  MeetingTiming,
} from "./use-meeting-timing";
import type { LocalMeetingImage } from "./use-meeting-outcome";
export function AttendanceLogModal({
  meeting,
  timing,
  showOutcomeRecords,
  needsOutcome,
  images,
  open,
  onClose,
  pending,
  onYes,
  onNo,
}: {
  meeting: ParentMeetingItem;
  timing: MeetingTiming;
  showOutcomeRecords: boolean;
  needsOutcome: boolean;
  images: LocalMeetingImage[];
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const m = meeting;
  return (
    <CardModal
      open={open}
      onClose={onClose}
      title="Attendance log"
      description="Full record of this parent meeting."
      size="md"
    >
      <div
        className={styles.modalBody}
        style={needsOutcome ? undefined : { marginBottom: 0 }}
      >
        <dl className={styles.kpiGrid} style={{ margin: 0 }}>
          <div className={styles.kpi}>
            <dt className={styles.metaLabel}>Date</dt>
            <dd className={styles.kpiValue} style={{ margin: 0 }}>
              {formatManilaDate(m.meetingDatetime)}
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt className={styles.metaLabel}>Time</dt>
            <dd className={styles.kpiValue} style={{ margin: 0 }}>
              {formatManilaTime(m.meetingDatetime)}
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt className={styles.metaLabel}>Venue</dt>
            <dd className={styles.kpiValue} style={{ margin: 0 }}>
              {venueLabel(m.venue)}
            </dd>
          </div>
          <div className={styles.kpi}>
            <dt className={styles.metaLabel}>Status</dt>
            <dd style={{ margin: 0 }}>
              {m.attended ? (
                <Badge variant="success">Attended</Badge>
              ) : timing.state === "live" ? (
                <Badge variant="success">Live now</Badge>
              ) : timing.state === "overdue" ? (
                <Badge variant="destructive">Overdue</Badge>
              ) : timing.state === "upcoming" ? (
                <Badge variant="outline">Upcoming</Badge>
              ) : (
                <Badge variant="outline">Booked</Badge>
              )}
            </dd>
          </div>
          <div className={`${styles.kpi} ${styles.kpiFull}`}>
            <dt className={styles.metaLabel}>Booked by</dt>
            <dd className={styles.kpiValue} style={{ margin: 0 }}>
              {m.recordedBy}
            </dd>
          </div>
          {showOutcomeRecords && m.attendanceLogbookRef ? (
            <div className={`${styles.kpi} ${styles.kpiFull}`}>
              <dt className={styles.metaLabel}>Logbook ref</dt>
              <dd
                className={`${styles.kpiValue} ${styles.mono}`}
                style={{ margin: 0 }}
              >
                {m.attendanceLogbookRef}
              </dd>
            </div>
          ) : null}
        </dl>
        {(m.invitees ?? []).length > 0 ? (
          <div>
            <p className={styles.metaLabel} style={{ margin: "0 0 0.375rem" }}>
              Invited · {(m.invitees ?? []).length}
            </p>
            <ul
              className={styles.badgeRow}
              style={{ margin: 0, padding: 0, listStyle: "none" }}
            >
              {(m.invitees ?? []).map((u) => (
                <li key={u.id}>
                  <Badge variant="secondary">{meetingInviteeLabel(u)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {showOutcomeRecords && (m.attendees ?? []).length > 0 ? (
          <div>
            <p className={styles.metaLabel} style={{ margin: "0 0 0.375rem" }}>
              Attendees · {m.attendees.length}
            </p>
            <ul
              className={styles.badgeRow}
              style={{ margin: 0, padding: 0, listStyle: "none" }}
            >
              {m.attendees.map((a, idx) => (
                <li key={`${a.name}-${idx}`}>
                  <Badge variant="secondary">{attendeeLabel(a)}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {showOutcomeRecords && (m.attachments ?? []).length > 0 ? (
          <div>
            <p className={styles.metaLabel} style={{ margin: "0 0 0.375rem" }}>
              Documents · {(m.attachments ?? []).length}
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {(m.attachments ?? []).map((d) => (
                <li key={d.id}>
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={d.fileName}
                    className={`${styles.metaValue} ${styles.mono}`}
                  >
                    {d.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {showOutcomeRecords && m.minutesOfMeeting ? (
          <div>
            <p className={styles.metaLabel} style={{ margin: "0 0 0.375rem" }}>
              Minutes
            </p>
            <div className={styles.logCard} style={{ marginTop: 0 }}>
              <p className={styles.cardText} style={{ margin: 0 }}>
                {m.minutesOfMeeting}
              </p>
            </div>
          </div>
        ) : null}
        {images.length > 0 ? (
          <div className={styles.thumbGrid}>
            {images.map((img) => (
              <figure key={img.url} className={styles.thumbItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className={styles.thumb} />
                <figcaption className={styles.thumbName} title={img.name}>
                  {img.name}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </div>
      {needsOutcome ? (
        <div className={styles.attendBtns}>
          <Button disabled={pending} onClick={onYes}>
            {pending ? (
              <Loader2
                className="animate-spin"
                aria-hidden="true"
                style={{ width: "0.875rem", height: "0.875rem" }}
              />
            ) : null}
            Yes
          </Button>
          <Button variant="outline" disabled={pending} onClick={onNo}>
            {pending ? (
              <Loader2
                className="animate-spin"
                aria-hidden="true"
                style={{ width: "0.875rem", height: "0.875rem" }}
              />
            ) : null}
            No
          </Button>
        </div>
      ) : null}
    </CardModal>
  );
}
