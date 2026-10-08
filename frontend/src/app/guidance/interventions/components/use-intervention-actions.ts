"use client";
import type { CounselingSessionType, InterventionOutcome, ReviewDecision } from "@/services/guidance/interventions.types";
import {
  cancelFollowUpSession,
  completeFollowUpSession,
  recordInterventionOutcome,
  rescheduleFollowUpSession,
  reviewIntervention,
  scheduleFollowUpSession,
  startFollowUp,
} from "@/services/guidance/interventions.service";
import { toast } from "@/components/ui/sonner";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import { useGuidanceInvalidate, useGuidanceMutation } from "../../overview/components/use-guidance-mutation";
function interventionSuccessMessage(action: string): { title: string; description: string } {
  switch (action) {
    case "start":
      return {
        title: "Follow-up started",
        description: "The intervention is now assigned to you and tracked in the queue.",
      };
    case "review":
      return {
        title: "Review saved",
        description: "Your decision was recorded on this follow-up.",
      };
    case "outcome":
      return {
        title: "Outcome recorded",
        description: "The closing note was saved and the case status updated.",
      };
    case "schedule":
      return {
        title: "Session booked",
        description: "The counseling session was added to the plan with its date and time.",
      };
    case "finish":
      return {
        title: "Session completed",
        description: "Session notes were saved. A booked follow-up stays on the plan.",
      };
    case "move":
      return {
        title: "Session moved",
        description: "The session was rescheduled to the new date and time.",
      };
    case "cancelSess":
      return {
        title: "Session cancelled",
        description: "The session was cancelled and removed from the upcoming list.",
      };
    default:
      return { title: "Saved", description: "Your change was recorded." };
  }
}
export function useInterventionActions(onMutateSuccess: () => void) {
  const invalidateGuidance = useGuidanceInvalidate();
  const actionMutation = useGuidanceMutation<
    unknown,
    { key: string; action: string; payload: unknown }
  >({
    sourceId: (variables) =>
      (variables.payload as { followUpId?: string } | undefined)?.followUpId ?? "",
    silentSuccess: true,
    successTitle: "Saved",
    errorFallback: "The change did not go through. Check your connection and try again.",
    onSuccessExtra: (_data, variables) => {
      toast.success(interventionSuccessMessage(variables.action));
      refreshBookingReminders();
    },
    mutationFn: async ({
      key,
      action,
      payload,
    }: {
      key: string;
      action: string;
      payload: unknown;
    }) => {
      switch (action) {
        case "start": {
          const p = payload as {
            recommendedAction: string;
            priority: "low" | "normal" | "high";
            intakeNotes?: string;
            firstSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return startFollowUp(key, p);
        }
        case "review": {
          const p = payload as {
            followUpId: string;
            decision: ReviewDecision;
            recommendedAction?: string;
          };
          return reviewIntervention(p.followUpId, {
            decision: p.decision,
            recommendedAction: p.recommendedAction,
          });
        }
        case "outcome": {
          const p = payload as {
            followUpId: string;
            outcomeStatus: InterventionOutcome;
            outcomeNotes?: string;
          };
          return recordInterventionOutcome(p.followUpId, {
            outcomeStatus: p.outcomeStatus,
            outcomeNotes: p.outcomeNotes,
          });
        }
        case "schedule": {
          const p = payload as {
            followUpId: string;
            scheduledAt: string;
            sessionType: CounselingSessionType;
            venue?: string;
          };
          return scheduleFollowUpSession(p.followUpId, {
            scheduledAt: p.scheduledAt,
            sessionType: p.sessionType,
            venue: p.venue,
          });
        }
        case "finish": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            sessionNotes: string;
            outcome?: string;
            followUpSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return completeFollowUpSession(p.followUpId, p.sessionId, {
            sessionNotes: p.sessionNotes,
            outcome: p.outcome,
            followUpSession: p.followUpSession,
          });
        }
        case "move": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            scheduledAt: string;
          };
          return rescheduleFollowUpSession(p.followUpId, p.sessionId, p.scheduledAt);
        }
        case "cancelSess": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            cancelReason?: string;
          };
          return cancelFollowUpSession(p.followUpId, p.sessionId, p.cancelReason);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  });
  const busyVars = actionMutation.isPending ? actionMutation.variables : null;
  const isBusy = (key: string, action: string) =>
    !!busyVars && busyVars.key === key && busyVars.action === action;
  const rowLocked = (key: string) => !!busyVars && busyVars.key === key;
  const isActionPending = actionMutation.isPending;
  const runAction = (key: string, action: string, payload: unknown) => {
    if (actionMutation.isPending) return;
    actionMutation.mutate(
      { key, action, payload },
      {
        onSuccess: () => {
          onMutateSuccess();
        },
      }
    );
  };
  return {
    invalidateGuidance,
    actionMutation,
    isBusy,
    rowLocked,
    isActionPending,
    runAction,
  };
}
