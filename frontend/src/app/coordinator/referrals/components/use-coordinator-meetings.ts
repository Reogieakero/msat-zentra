"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCaseMeetings,
  fetchCoordinatorCaseDetail,
} from "@/services/coordinator/cases.service";
import type {
  AdmCaseRow,
  AdmMeeting,
} from "@/services/coordinator/coordinator.types";
function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}
export function useCoordinatorMeetings(selected: AdmCaseRow | null) {
  const selectedProfileId =
    selected && !isEarlyRow(selected) ? selected.id : null;
  const earlyRowId = selected && isEarlyRow(selected) ? selected.id : null;
  const meetingsKey = selectedProfileId ?? earlyRowId;
  const meetingsQuery = useQuery({
    queryKey: ["coordinator-meetings", meetingsKey],
    queryFn: async ({ signal }) => {
      if (selectedProfileId) return fetchCaseMeetings(selectedProfileId, signal);
      const detail = await fetchCoordinatorCaseDetail(earlyRowId as string, signal);
      return detail.meetings.map((m) => ({
        id: m.id,
        meetingDatetime: m.meetingDatetime,
        venue: m.venue,
        attended: m.attended,
        parentConfirmedAt: m.parentConfirmedAt,
        minutesOfMeeting: m.minutesOfMeeting,
        attendanceLogbookRef: m.attendanceLogbookRef,
        attendees: m.attendees,
        invitees: m.invitees ?? [],
        attachments: m.attachments ?? [],
        recordedBy: m.recordedBy,
      }));
    },
    enabled: meetingsKey !== null,
    staleTime: 30_000,
  });
  const meetings: AdmMeeting[] = React.useMemo(
    () => (meetingsQuery.data ?? []) as AdmMeeting[],
    [meetingsQuery.data],
  );
  return {
    selectedProfileId,
    meetings,
    meetingsPending: meetingsQuery.isPending,
    meetingsError: meetingsQuery.isError,
    refetchMeetings: () => {
      void meetingsQuery.refetch();
    },
  };
}
