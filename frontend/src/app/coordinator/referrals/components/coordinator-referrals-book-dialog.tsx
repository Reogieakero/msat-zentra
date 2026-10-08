"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  BookSessionDialog,
  type BookSessionFields,
  type InviteStaffOption,
} from "@/components/session-booking/BookSessionDialog";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";

export interface CoordinatorBookFields {
  meetingDatetime: string;
  venue: "school" | "home";
  logbook: string;
  inviteeIds: string[];
}

export interface CoordinatorBookInitial {
  id: string;
  datetime: string;
  venue: string;
  logbook?: string | null;

  invitees?: { id: string; fullName?: string; role?: string }[];
}

interface CoordinatorReferralsBookDialogProps {
  open: boolean;
  selected: AdmCaseRow | null;

  rescheduleMeeting?: CoordinatorBookInitial | null;

  venuePreset?: "school" | "home" | null;
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

export function CoordinatorReferralsBookDialog({
  open,
  selected,
  rescheduleMeeting = null,
  venuePreset = null,
  pending,
  serverError = null,
  onClose,
  onSubmit,
}: CoordinatorReferralsBookDialogProps) {

  const caseParams =
    selected && selected.id.startsWith("referral:")
      ? { referralId: selected.id.slice("referral:".length) }
      : selected
        ? { profileId: selected.id }
        : {};
  const caseKey = "referralId" in caseParams ? `r:${caseParams.referralId}` : "profileId" in caseParams ? `p:${caseParams.profileId}` : "none";
  const staffQuery = useQuery<{ staff: InviteStaffOption[]; sectionAdviserId: string | null }>({
    queryKey: ["coordinator-invite-staff", caseKey],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/adm/staff", { params: caseParams });
      return data;
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });
  const scopedAdviserId = staffQuery.data?.sectionAdviserId ?? null;

  const adviserRow = (staffQuery.data?.staff ?? []).find(
    (s) => s.role === "adviser" || (scopedAdviserId !== null && s.id === scopedAdviserId),
  );
  const noAdviserAssigned =
    open &&
    caseKey !== "none" &&
    !staffQuery.isPending &&
    !staffQuery.isError &&
    !adviserRow;

  if (!open) return null;

  function handleSubmit(f: BookSessionFields) {
    onSubmit({
      meetingDatetime: f.scheduledAt,
      venue: f.sessionType === "home" ? "home" : "school",
      logbook: f.venue,
      inviteeIds: f.inviteeIds ?? [],
    });
  }

  const isReschedule = rescheduleMeeting !== null;
  const initial = rescheduleMeeting ? splitDatetime(rescheduleMeeting.datetime) : null;

  return (
    <BookSessionDialog
      open
      onClose={onClose}
      onSubmit={handleSubmit}
      inviteStaff={staffQuery.data?.staff}
      initialInviteIds={(rescheduleMeeting?.invitees ?? []).map((u) => u.id)}
      sectionAdviserId={scopedAdviserId}
      inviteHint={
        noAdviserAssigned
          ? "No adviser is assigned to this student's section — ask the principal or registrar to assign one to invite them."
          : "Invited staff get a notification now and a reminder card 5 minutes before the meeting."
      }
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
      initialDate={initial?.date ?? ""}
      initialTime={initial?.time ?? ""}
      initialVenue={rescheduleMeeting?.logbook ?? ""}
      initialSessionType={
        rescheduleMeeting
          ? rescheduleMeeting.venue === "home"
            ? "home"
            : "school"
          : (venuePreset ?? undefined)
      }
      defaultSessionType={venuePreset ?? "school"}
      busy={pending}
      serverError={serverError}
      submitLabel={isReschedule ? "Reschedule meeting" : "Book meeting"}
      busyLabel={isReschedule ? "Rescheduling…" : "Booking…"}
      idPrefix="coord-book"
    />
  );
}
