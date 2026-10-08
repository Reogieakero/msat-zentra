"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import type {
  AdmCaseRow,
  AdmMeeting,
} from "@/services/coordinator/coordinator.types";
function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}
interface Args {
  selected: AdmCaseRow | null;
  meetings: AdmMeeting[];
  invalidateReferrals: () => void;
}
export function useCoordinatorBooking({ selected, meetings, invalidateReferrals }: Args) {
  const queryClient = useQueryClient();
  const [bookOpen, setBookOpen] = React.useState(false);
  const [bookTarget, setBookTarget] = React.useState<AdmCaseRow | null>(null);
  const [bookVenuePreset, setBookVenuePreset] = React.useState<"school" | "home" | null>(null);
  function openBook() {
    if (selected) setBookTarget(selected);
    setBookOpen(true);
  }
  function bookForRow(row: AdmCaseRow) {
    setBookTarget(row);
    setBookOpen(true);
  }
  const rescheduleMeeting = React.useMemo(() => {
    const target = bookTarget ?? selected;
    if (!target) return null;
    if (selected && target.id === selected.id && meetings.length > 0) {
      const pending = meetings.find((m) => !m.attended);
      if (pending) {
        return {
          id: pending.id,
          datetime: pending.meetingDatetime,
          venue: pending.venue,
          logbook: pending.attendanceLogbookRef,
          invitees: pending.invitees,
        };
      }
      return null;
    }
    const rowMeeting = target.meeting ?? null;
    if (rowMeeting && !rowMeeting.attended && rowMeeting.id) {
      return {
        id: rowMeeting.id,
        datetime: rowMeeting.datetime,
        venue: rowMeeting.venue,
        invitees: (rowMeeting.inviteeIds ?? []).map((id) => ({ id })),
      };
    }
    return null;
  }, [bookTarget, selected, meetings]);
  const bookMode = rescheduleMeeting ? ("reschedule" as const) : ("book" as const);
  const bookMutation = useMutation({
    mutationFn: async (fields: {
      meetingDatetime: string;
      venue: "school" | "home";
      logbook: string;
      inviteeIds: string[];
    }) => {
      if (rescheduleMeeting) {
        const { data } = await apiClient.patch(
          `/api/adm/meetings/${rescheduleMeeting.id}/reschedule`,
          {
            meetingDatetime: new Date(fields.meetingDatetime).toISOString(),
            venue: fields.venue,
            ...(fields.logbook.trim()
              ? { attendanceLogbookRef: fields.logbook.trim() }
              : {}),
            inviteeIds: fields.inviteeIds,
          },
        );
        return { meeting: data, venue: fields.venue, rescheduled: true as const };
      }
      const target = bookTarget ?? selected;
      if (!target) throw new Error("No case selected.");
      const url = isEarlyRow(target)
        ? `/api/adm/referral/${target.id.replace(/^referral:/, "")}/meetings`
        : `/api/adm/${target.id}/meetings`;
      const { data } = await apiClient.post(url, {
        meetingDatetime: new Date(fields.meetingDatetime).toISOString(),
        venue: fields.venue,
        ...(fields.logbook.trim()
          ? { attendanceLogbookRef: fields.logbook.trim() }
          : {}),
        ...(fields.inviteeIds.length > 0 ? { inviteeIds: fields.inviteeIds } : {}),
      });
      return { meeting: data, venue: fields.venue, rescheduled: false as const };
    },
    onSuccess: ({ meeting, venue: bookedVenue, rescheduled }) => {
      const meetingId =
        typeof (meeting as { id?: unknown })?.id === "string"
          ? (meeting as { id: string }).id
          : null;
      if (meetingId) markSelfNotified(meetingId);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      refreshBookingReminders();
      closeBook();
      toast.success({
        title: rescheduled ? "Meeting rescheduled" : "Meeting booked",
        description: rescheduled
          ? bookedVenue === "home"
            ? "Home visitation moved to the new schedule."
            : "In-school meeting moved to the new schedule."
          : bookedVenue === "home"
            ? "Home visitation scheduled."
            : "In-school meeting scheduled.",
      });
    },
    onError: (err) =>
      toast.error({
        title: rescheduleMeeting ? "Could not reschedule meeting" : "Could not book meeting",
        description: apiErrorMessage(err),
      }),
  });
  function closeBook() {
    setBookOpen(false);
    setBookTarget(null);
    setBookVenuePreset(null);
    bookMutation.reset();
  }
  return {
    bookOpen,
    setBookOpen,
    bookTarget,
    setBookTarget,
    bookVenuePreset,
    setBookVenuePreset,
    openBook,
    bookForRow,
    closeBook,
    bookPending: bookMutation.isPending,
    bookPendingId: bookMutation.isPending ? (bookTarget?.id ?? selected?.id ?? null) : null,
    bookError: bookMutation.error ? apiErrorMessage(bookMutation.error) : null,
    bookMode,
    rescheduleMeeting,
    confirmBook: (fields: {
      meetingDatetime: string;
      venue: "school" | "home";
      logbook: string;
      inviteeIds: string[];
    }) => {
      if (!bookMutation.isPending) bookMutation.mutate(fields);
    },
  };
}
