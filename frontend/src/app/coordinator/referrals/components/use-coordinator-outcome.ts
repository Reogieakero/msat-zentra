"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { inviteeToAttendee } from "@/services/coordinator/labels";
import type {
  AdmCaseRow,
  AdmMeeting,
  AdmMeetingInvitee,
} from "@/services/coordinator/coordinator.types";
interface Args {
  invalidateReferrals: () => void;
  onMissed?: (row: AdmCaseRow) => void;
}
export function useCoordinatorOutcome({ invalidateReferrals, onMissed }: Args) {
  const queryClient = useQueryClient();
  const [outcomeTarget, setOutcomeTarget] = React.useState<AdmMeeting | null>(
    null,
  );
  const [outcomeAttended, setOutcomeAttended] = React.useState(true);
  const [outcomeMinutes, setOutcomeMinutes] = React.useState("");
  const [outcomeLogbook, setOutcomeLogbook] = React.useState("");
  const [outcomeInviteeIds, setOutcomeInviteeIds] = React.useState<string[]>([]);
  const [outcomeRow, setOutcomeRow] = React.useState<AdmCaseRow | null>(null);
  function openOutcome(m: AdmMeeting, row?: AdmCaseRow | null) {
    setOutcomeRow(row ?? null);
    setOutcomeTarget(m);
    setOutcomeAttended(m.attended);
    setOutcomeMinutes(m.minutesOfMeeting ?? "");
    setOutcomeLogbook(m.attendanceLogbookRef ?? "");
    const recorded = new Set(
      (m.attendees ?? []).map((a) => a.userId).filter((v): v is string => !!v),
    );
    setOutcomeInviteeIds((m.invitees ?? []).map((u) => u.id).filter((id) => recorded.has(id)));
  }
  function closeOutcome() {
    setOutcomeTarget(null);
    setOutcomeInviteeIds([]);
  }
  const outcomeMutation = useMutation({
    mutationFn: async () => {
      if (!outcomeTarget) throw new Error("No meeting selected.");
      const byId = new Map((outcomeTarget.invitees ?? []).map((u) => [u.id, u]));
      const kept = (outcomeTarget.attendees ?? []).filter((a) => !a.userId);
      const checked = outcomeInviteeIds
        .map((id) => byId.get(id))
        .filter((u): u is AdmMeetingInvitee => !!u)
        .map(inviteeToAttendee);
      const { data } = await apiClient.patch(
        `/api/adm/meetings/${outcomeTarget.id}`,
        {
          attended: outcomeAttended,
          ...(outcomeMinutes.trim()
            ? { minutesOfMeeting: outcomeMinutes.trim() }
            : {}),
          ...(outcomeLogbook.trim()
            ? { attendanceLogbookRef: outcomeLogbook.trim() }
            : {}),
          ...(outcomeAttended
            ? { attendees: [...checked, ...kept].slice(0, 20) }
            : {}),
        },
      );
      return data;
    },
    onSuccess: (data) => {
      void data;
      if (outcomeTarget) markSelfNotified(outcomeTarget.id);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      refreshBookingReminders();
      const wasMissed = !outcomeAttended;
      const missedRow = outcomeRow;
      closeOutcome();
      if (wasMissed && missedRow) {
        onMissed?.(missedRow);
        toast.success({
          title: "Marked as not attended",
          description: "Booking the home visitation now.",
        });
      } else {
        toast.success({
          title: outcomeAttended ? "Attendance recorded" : "Outcome recorded",
          description: outcomeAttended
            ? "Minutes logged — the case can move to certification."
            : "Marked as not attended — the home visitation path applies.",
        });
      }
    },
    onError: (err) =>
      toast.error({
        title: "Could not record outcome",
        description: apiErrorMessage(err),
      }),
  });
  return {
    outcomeTarget,
    setOutcomeTarget,
    outcomeAttended,
    setOutcomeAttended,
    outcomeMinutes,
    setOutcomeMinutes,
    outcomeLogbook,
    setOutcomeLogbook,
    outcomeInviteeIds,
    setOutcomeInviteeIds,
    closeOutcome,
    openOutcome,
    outcomePending: outcomeMutation.isPending,
    confirmOutcome: () => {
      if (!outcomeMutation.isPending) outcomeMutation.mutate();
    },
  };
}
