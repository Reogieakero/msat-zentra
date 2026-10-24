"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
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
interface OutcomeVars {
  target: AdmMeeting;
  taskId: string | null;
}
export function useCoordinatorOutcome({ invalidateReferrals, onMissed }: Args) {
  const queryClient = useQueryClient();
  const dock = useDock();
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
    mutationFn: async ({ target }: OutcomeVars) => {
      const byId = new Map((target.invitees ?? []).map((u) => [u.id, u]));
      const kept = (target.attendees ?? []).filter((a) => !a.userId);
      const checked = outcomeInviteeIds
        .map((id) => byId.get(id))
        .filter((u): u is AdmMeetingInvitee => !!u)
        .map(inviteeToAttendee);
      const { data } = await apiClient.patch(
        `/api/adm/meetings/${target.id}`,
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
    onSuccess: (data, vars) => {
      void data;
      markSelfNotified(vars.target.id);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      refreshBookingReminders();
      if (vars.taskId) {
        dock.completeTask(
          vars.taskId,
          outcomeAttended ? "Outcome recorded" : "Marked as not attended",
        );
      }
      const wasMissed = !outcomeAttended;
      const missedRow = outcomeRow;
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
    onError: (err, vars) => {
      if (vars?.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not record outcome",
        description: apiErrorMessage(err),
      });
    },
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
      if (outcomeMutation.isPending || !outcomeTarget) return;
      const target = outcomeTarget;
      let taskId: string | null = null;
      try {
        taskId = dock.startTask({
          kind: "generic",
          title: "Recording meeting outcome",
          description: `${
            target.venue === "home" ? "Home visitation" : "In-school meeting"
          } · ${outcomeAttended ? "attended" : "not attended"}`,
        });
      } catch {
        taskId = null;
      }
      // Close at once — the shared Dock reports the request until it settles.
      closeOutcome();
      outcomeMutation.mutate({ target, taskId });
    },
  };
}
