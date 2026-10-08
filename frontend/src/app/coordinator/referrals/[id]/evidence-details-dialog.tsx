"use client";

import { Badge } from "@/components/ui/badge";
import { CardModal } from "@/components/ui/CardModal";
import {
  attendeeLabel,
  formatManilaDate,
  formatManilaTime,
  friendlyWords,
  venueLabel,
} from "@/services/coordinator/labels";
import type {
  AdmFormRef,
  MeetingAttendee,
} from "@/services/coordinator/coordinator.types";
import { FORM_LABELS } from "../components/coordinator-referrals-constants";
import styles from "./case-page.module.css";

export interface EvidenceMeeting {
  id: string;
  meetingDatetime: string;
  venue: string;
  attended: boolean;
  minutesOfMeeting: string | null;
  attendanceLogbookRef: string | null;
  attendees: MeetingAttendee[];
}

interface EvidenceDetailsDialogProps {
  target: AdmFormRef | null;
  meetings: EvidenceMeeting[];
  certificationDetails: unknown;
  onClose: () => void;
}

function certificationRecord(value: unknown): {
  recommendation?: string;
  certifiedBy?: string;
  certifiedAt?: string;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const r = value as Record<string, unknown>;
  const out: { recommendation?: string; certifiedBy?: string; certifiedAt?: string } = {};
  if (typeof r.recommendation === "string" && r.recommendation.trim()) {
    out.recommendation = r.recommendation;
  }
  if (typeof r.certifiedBy === "string" && r.certifiedBy.trim()) {
    out.certifiedBy = r.certifiedBy;
  }
  if (typeof r.certifiedAt === "string" && r.certifiedAt.trim()) {
    out.certifiedAt = r.certifiedAt;
  }
  return out;
}

export function EvidenceDetailsDialog({
  target,
  meetings,
  certificationDetails,
  onClose,
}: EvidenceDetailsDialogProps) {
  const title = target
    ? (FORM_LABELS[target.formType] ?? friendlyWords(target.formType))
    : "";
  const attended = meetings.filter((m) => m.attended);
  const cert = certificationRecord(certificationDetails);

  return (
    <CardModal
      open={target !== null}
      onClose={onClose}
      title={title}
      description={
        target ? <>Status: {friendlyWords(target.status)}</> : undefined
      }
      size="md"
    >
      {target?.formType === "MINUTES_OF_MEETING" ? (
        attended.length === 0 ? (
          <p className={styles.muted} style={{ margin: 0 }}>
            No attended meeting on record yet.
          </p>
        ) : (
          <div className={styles.modalBody} style={{ marginBottom: 0 }}>
            {attended.map((m, i) => (
              <section
                key={m.id}
                aria-label={
                  attended.length > 1
                    ? `Attended meeting ${i + 1} of ${attended.length}`
                    : "Attended meeting"
                }
              >
                {attended.length > 1 ? (
                  <p className={styles.modalSectionTitle}>
                    Meeting {i + 1} of {attended.length}
                  </p>
                ) : null}
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
                      <Badge variant="success">Attended</Badge>
                    </dd>
                  </div>
                  {m.attendanceLogbookRef ? (
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
                {m.attendees.length > 0 ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p
                      className={styles.metaLabel}
                      style={{ margin: "0 0 0.375rem" }}
                    >
                      Attendees · {m.attendees.length}
                    </p>
                    <ul
                      className={styles.badgeRow}
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                      }}
                    >
                      {m.attendees.map((a, idx) => (
                        <li key={`${a.name}-${idx}`}>
                          <Badge variant="secondary">
                            {attendeeLabel(a)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.minutesOfMeeting ? (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p
                      className={styles.metaLabel}
                      style={{ margin: "0 0 0.375rem" }}
                    >
                      Minutes
                    </p>
                    <div
                      className={styles.logCard}
                      style={{ marginTop: 0 }}
                    >
                      <p
                        className={styles.cardText}
                        style={{ margin: 0 }}
                      >
                        {m.minutesOfMeeting}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )
      ) : target?.formType === "CERTIFICATION" ? (
        <div>
          {cert?.recommendation ? (
            <p className={styles.cardText} style={{ marginTop: 0 }}>
              {cert.recommendation}
            </p>
          ) : (
            <p className={styles.muted} style={{ margin: 0 }}>
              No recommendation text recorded yet.
            </p>
          )}
          {cert?.certifiedAt ? (
            <p className={styles.muted} style={{ margin: "0.5rem 0 0" }}>
              Certified {cert.certifiedAt.slice(0, 10)}
              {cert.certifiedBy ? ` · ${cert.certifiedBy}` : ""}
            </p>
          ) : null}
        </div>
      ) : target?.formType === "HV_FORM" ? (
        <p className={styles.muted} style={{ margin: 0 }}>
          Recorded from the home visitation on this case. The full visit
          report stays with the guidance desk.
        </p>
      ) : target ? (
        <p className={styles.muted} style={{ margin: 0 }}>
          {title} — {friendlyWords(target.status)}.
        </p>
      ) : null}
    </CardModal>
  );
}
