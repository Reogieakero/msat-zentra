"use client";
import * as React from "react";
import { type QueryClient } from "@tanstack/react-query";
import type { AtRiskStudentItem, CounselingSessionItem, CounselingSessionType, InterventionOutcome, ReviewDecision } from "@/services/guidance/interventions.types";
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
function isInterventionsData(v: unknown): v is { students: AtRiskStudentItem[] } {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { students?: unknown }).students)
  );
}

const nowIso = () => new Date().toISOString();

function tempSession(
  scheduledAt: string,
  sessionType: CounselingSessionType,
  venue?: string
): CounselingSessionItem {
  return {
    id: `temp-${Date.now()}`,
    sessionType,
    scheduledAt,
    date: scheduledAt,
    venue: venue ?? "",
    status: "scheduled",
    sessionNotes: "",
    outcome: "",
    cancelReason: "",
    createdAt: nowIso(),
    completedAt: "",
    attachmentsCount: 0,
  };
}

function applyInterventionAction(
  item: AtRiskStudentItem,
  action: string,
  payload: unknown
): AtRiskStudentItem {
  const p = (payload ?? {}) as Record<string, unknown>;
  const followUpId = p.followUpId as string | undefined;
  if (action === "start") {
    const sp = p as {
      recommendedAction?: string;
      priority?: string;
      intakeNotes?: string;
      firstSession?: { scheduledAt: string; sessionType: CounselingSessionType; venue?: string };
    };
    return {
      ...item,
      intervention: {
        id: item.intervention?.id ?? `temp-${Date.now()}`,
        recommendedAction: sp.recommendedAction ?? item.intervention?.recommendedAction ?? "",
        assigneeId: item.intervention?.assigneeId ?? "",
        assignee: item.intervention?.assignee ?? "",
        approvalStatus: item.intervention?.approvalStatus ?? "pending",
        outcomeStatus: item.intervention?.outcomeStatus ?? "ongoing",
        outcomeNotes: item.intervention?.outcomeNotes ?? "",
        priority: sp.priority ?? item.intervention?.priority ?? "normal",
        intakeNotes: sp.intakeNotes ?? item.intervention?.intakeNotes ?? "",
        sessions: sp.firstSession
          ? [...(item.intervention?.sessions ?? []), tempSession(sp.firstSession.scheduledAt, sp.firstSession.sessionType, sp.firstSession.venue)]
          : (item.intervention?.sessions ?? []),
        completedSessions: item.intervention?.completedSessions ?? 0,
        createdAt: item.intervention?.createdAt ?? nowIso(),
      },
    };
  }
  if (!item.intervention) return item;
  if (followUpId && item.intervention.id !== followUpId) return item;
  const iv = item.intervention;
  switch (action) {
    case "review": {
      const decision = (p.decision as ReviewDecision | undefined) ?? "approved";
      return {
        ...item,
        intervention: {
          ...iv,
          approvalStatus: decision,
          recommendedAction: (p.recommendedAction as string | undefined) ?? iv.recommendedAction,
        },
      };
    }
    case "outcome":
      return {
        ...item,
        intervention: {
          ...iv,
          outcomeStatus: (p.outcomeStatus as InterventionOutcome | undefined) ?? iv.outcomeStatus,
          outcomeNotes: (p.outcomeNotes as string | undefined) ?? iv.outcomeNotes,
        },
      };
    case "schedule": {
      const sp = p as { scheduledAt?: string; sessionType?: CounselingSessionType; venue?: string };
      if (!sp.scheduledAt) return item;
      return {
        ...item,
        intervention: {
          ...iv,
          sessions: [...iv.sessions, tempSession(sp.scheduledAt, sp.sessionType ?? "individual", sp.venue)],
        },
      };
    }
    case "finish": {
      const sp = p as { sessionId?: string; sessionNotes?: string; outcome?: string };
      return {
        ...item,
        intervention: {
          ...iv,
          sessions: iv.sessions.map((s) =>
            s.id === sp.sessionId
              ? { ...s, status: "completed", sessionNotes: (sp.sessionNotes as string) ?? s.sessionNotes, outcome: (sp.outcome as string) ?? s.outcome, completedAt: nowIso() }
              : s
          ),
        },
      };
    }
    case "move": {
      const sp = p as { sessionId?: string; scheduledAt?: string };
      return {
        ...item,
        intervention: {
          ...iv,
          sessions: iv.sessions.map((s) =>
            s.id === sp.sessionId
              ? { ...s, scheduledAt: (sp.scheduledAt as string) ?? s.scheduledAt, date: (sp.scheduledAt as string) ?? s.date }
              : s
          ),
        },
      };
    }
    case "cancelSess": {
      const sp = p as { sessionId?: string; cancelReason?: string };
      return {
        ...item,
        intervention: {
          ...iv,
          sessions: iv.sessions.map((s) =>
            s.id === sp.sessionId
              ? { ...s, status: "cancelled", cancelReason: (sp.cancelReason as string) ?? s.cancelReason }
              : s
          ),
        },
      };
    }
    default:
      return item;
  }
}

/** Instantly patch every cached interventions/alerts list; returns a rollback. */
function patchInterventionCaches(
  qc: QueryClient,
  key: string,
  action: string,
  payload: unknown
): () => void {
  const snapshots: { key: readonly unknown[]; data: unknown }[] = [];
  const followUpId = (payload as { followUpId?: string } | null)?.followUpId;
  const match = (item: AtRiskStudentItem) =>
    item.studentKey === key || (!!followUpId && item.intervention?.id === followUpId);
  const patch = (item: AtRiskStudentItem) =>
    match(item) ? applyInterventionAction(item, action, payload) : item;
  const targets: { queryKey: readonly string[]; updater: (old: unknown) => unknown }[] = [
    {
      queryKey: ["guidance-interventions"],
      updater: (old: unknown) =>
        isInterventionsData(old) ? { ...old, students: old.students.map(patch) } : old,
    },
    {
      queryKey: ["guidance-alerts"],
      updater: (old: unknown) =>
        Array.isArray(old) ? (old as AtRiskStudentItem[]).map((i) => patch(i as AtRiskStudentItem)) : old,
    },
  ];
  for (const t of targets) {
    for (const [qk, data] of qc.getQueriesData({ queryKey: [...t.queryKey] })) {
      snapshots.push({ key: qk, data });
      qc.setQueryData(qk, t.updater(data));
    }
  }
  return () => {
    for (const s of snapshots) qc.setQueryData(s.key, s.data);
  };
}

export function useInterventionActions(onMutateSuccess: () => void) {
  const invalidateGuidance = useGuidanceInvalidate();
  const actionMutation = useGuidanceMutation<
    unknown,
    { key: string; action: string; payload: unknown }
  >({
    sourceId: (variables) =>
      (variables.payload as { followUpId?: string } | undefined)?.followUpId ?? "",
    scopes: ["interventions", "alerts", "notifications"],
    optimisticUpdate: (qc, variables) =>
      patchInterventionCaches(qc, variables.key, variables.action, variables.payload),
    silentSuccess: true,
    successTitle: "Saved",
    errorFallback: "The change did not go through. Check your connection and try again.",
    onSuccessExtra: (_data, variables) => {
      // UI already patched optimistically — recompute reminders then pop the
      // sileo toast instantly on server success.
      refreshBookingReminders(true);
      toast.success(interventionSuccessMessage(variables.action));
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
  // Short double-submit guard — released when the mutation settles
  // (not after refetch). UI/toast no longer wait for refetch.
  const [settling, setSettling] = React.useState(false);
  const isActionPending = actionMutation.isPending || settling;
  const runAction = (key: string, action: string, payload: unknown) => {
    if (actionMutation.isPending || settling) return;
    // Close dialogs instantly; the row is already patched optimistically.
    onMutateSuccess();
    setSettling(true);
    actionMutation.mutate(
      { key, action, payload },
      {
        onSettled: () => {
          setSettling(false);
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
