"use client";

import {
  BookSessionDialog,
  type BookSessionFields,
} from "@/components/session-booking/BookSessionDialog";
import type { AdmCaseRow } from "../../components/coordinator-data";

export interface CoordinatorBookFields {
  meetingDatetime: string;
  venue: "school" | "home";
  logbook: string;
}

export interface CoordinatorBookInitial {
  id: string;
  datetime: string;
  venue: string;
  logbook?: string | null;
}

interface CoordinatorReferralsBookDialogProps {
  open: boolean;
  selected: AdmCaseRow | null;
  /** Set when the case already has a booked (unattended) meeting — the
      dialog reschedules it instead of creating a second booking. */
  rescheduleMeeting?: CoordinatorBookInitial | null;
  pending: boolean;
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (fields: CoordinatorBookFields) => void;
}

function splitDatetime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Thin wrapper around the shared book-session modal — the same dialog as
 * the nurse clinic desk and the guidance desks. The kind dropdown picks
 * the venue (In school / Home visitation) and the free-text box takes the
 * attendance logbook ref. No student or parent account is ever asked for.
 *
 * When `rescheduleMeeting` is set the dialog prefills from the booked
 * meeting and saves as a reschedule — a booked case can never gain a
 * second booking this way.
 */
export function CoordinatorReferralsBookDialog({
  open,
  selected,
  rescheduleMeeting = null,
  pending,
  serverError = null,
  onClose,
  onSubmit,
}: CoordinatorReferralsBookDialogProps) {
  if (!open) return null;

  function handleSubmit(f: BookSessionFields) {
    onSubmit({
      meetingDatetime: f.scheduledAt,
      venue: f.sessionType === "home" ? "home" : "school",
      logbook: f.venue,
    });
  }

  const isReschedule = rescheduleMeeting !== null;
  const initial = rescheduleMeeting ? splitDatetime(rescheduleMeeting.datetime) : null;

  return (
    <BookSessionDialog
      open
      onClose={onClose}
      onSubmit={handleSubmit}
      title={isReschedule ? "Reschedule meeting" : "Book session"}
      description={
        selected
          ? isReschedule
            ? `Reschedule the booked parent meeting for ${selected.student} — pick a new date, time, or venue.`
            : `Book a parent meeting for ${selected.student} — in school or as a home visitation.`
          : isReschedule
            ? "Reschedule the booked parent meeting — pick a new date, time, or venue."
            : "Book a parent meeting."
      }
      venueLabel="Attendance logbook ref (optional)"
      venuePlaceholder="e.g. Logbook p. 42"
      showSessionType
      sessionTypeLabel="Venue"
      sessionTypeOptions={[
        { value: "school", label: "In school" },
        { value: "home", label: "Home visitation" },
      ]}
      defaultSessionType="school"
      initialDate={initial?.date ?? ""}
      initialTime={initial?.time ?? ""}
      initialVenue={rescheduleMeeting?.logbook ?? ""}
      initialSessionType={
        rescheduleMeeting
          ? rescheduleMeeting.venue === "home"
            ? "home"
            : "school"
          : undefined
      }
      busy={pending}
      serverError={serverError}
      submitLabel={isReschedule ? "Reschedule meeting" : "Book meeting"}
      busyLabel={isReschedule ? "Rescheduling…" : "Booking…"}
      idPrefix="coord-book"
    />
  );
}
