"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attendeeLabel,
  formatManilaDate,
  formatManilaTime,
  friendlyWords,
  venueLabel,
  type AdmFormRef,
  type MeetingAttendee,
} from "../../components/coordinator-data";
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

/**
 * Per-evidence details overlay for the case file's Evidence chain.
 * Referral + anecdotal forms open their full official previews instead
 * (handled by the caller); everything else renders here.
 */
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
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Status: {friendlyWords(target.status)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {target?.formType === "MINUTES_OF_MEETING" ? (
          attended.length === 0 ? (
            <p className={styles.muted} style={{ margin: 0 }}>
              No attended meeting on record yet.
            </p>
          ) : (
            <div className={styles.sheetBody}>
              {attended.map((m) => (
                <dl key={m.id} className={styles.metaList}>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>Schedule</dt>
                    <dd className={styles.metaValue} style={{ margin: 0 }}>
                      {formatManilaDate(m.meetingDatetime)} at{" "}
                      {formatManilaTime(m.meetingDatetime)}
                    </dd>
                  </div>
                  <div className={styles.metaItem}>
                    <dt className={styles.metaLabel}>Venue</dt>
                    <dd className={styles.metaValue} style={{ margin: 0 }}>
                      {venueLabel(m.venue)}
                    </dd>
                  </div>
                  {m.attendanceLogbookRef ? (
                    <div className={styles.metaItem}>
                      <dt className={styles.metaLabel}>Logbook ref</dt>
                      <dd
                        className={`${styles.metaValue} ${styles.mono}`}
                        style={{ margin: 0 }}
                      >
                        {m.attendanceLogbookRef}
                      </dd>
                    </div>
                  ) : null}
                  {m.attendees.length > 0 ? (
                    <div className={styles.metaItem}>
                      <dt className={styles.metaLabel}>
                        Attendees ({m.attendees.length})
                      </dt>
                      <dd className={styles.metaValue} style={{ margin: 0 }}>
                        {m.attendees.map(attendeeLabel).join("; ")}
                      </dd>
                    </div>
                  ) : null}
                  {m.minutesOfMeeting ? (
                    <div className={styles.metaItem}>
                      <dt className={styles.metaLabel}>Minutes</dt>
                      <dd className={styles.metaValue} style={{ margin: 0 }}>
                        {m.minutesOfMeeting}
                      </dd>
                    </div>
                  ) : null}
                </dl>
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
