"use client";

import { useState } from "react";
import { type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import type {
  CounselingSessionType,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import {
  acceptReferral,
  addReferralNote,
  dismissReferral,
  escalateReferral,
  flagReferralFollowUp,
  initiateAdm,
  reassignReferral,
  referToSpecialist,
  updateReferralStatus,
} from "@/services/guidance/referrals.service";
import {
  cancelSession,
  completeSession,
  deleteSession,
  rescheduleSession,
  scheduleSession,
} from "@/services/guidance/sessions.service";
import {
  INITIAL_GUIDANCE_FORM,
  type GuidanceActionDialogs as ActionDialogs,
  type GuidanceActionFormState as ActionFormState,
} from "./GuidanceReferralDialogs";
import {
  toDateInputValue,
  toTimeInputValue,
} from "./guidance-referrals-format";
import {
  useGuidanceInvalidate,
  useGuidanceMutation,
} from "../../overview/components/use-guidance-mutation";

function referralActionMessage(action: string): { title: string; description: string } | null {
  switch (action) {
    case "escalate":
      return {
        title: "Sent to a higher office",
        description: "The case was escalated with your reason attached for the receiving office.",
      };
    case "reassign":
      return {
        title: "Case passed on",
        description: "The referral was reassigned and now appears on the new handler's desk.",
      };
    case "dismiss":
      return {
        title: "Case closed",
        description: "The referral was closed with your reason kept on record.",
      };
    case "specialist":
      return {
        title: "Specialist asked",
        description: "The referral was sent for specialist input with your reason attached.",
      };
    case "adm":
      return {
        title: "ADM process started",
        description: "The case is now on the ADM track and visible in the ADM queue.",
      };
    case "accept":
      return {
        title: "Case accepted",
        description: "The case is now in progress on your desk. A first session stays optional.",
      };
    case "schedule":
      return {
        title: "Session booked",
        description: "The counseling session was added with its date, time, and venue.",
      };
    case "finish":
      return {
        title: "Session completed",
        description: "Session notes were saved. Any booked follow-up stays on the plan.",
      };
    case "move":
      return {
        title: "Session moved",
        description: "The session was rescheduled to the new date and time.",
      };
    case "cancelSess":
      return {
        title: "Session cancelled",
        description: "The session was cancelled with your reason kept on record.",
      };
    case "deleteSess":
      return {
        title: "Session removed",
        description: "The cancelled session was permanently removed from the plan.",
      };
    case "resolve":
      return {
        title: "Case closed",
        description: "The closing summary was saved and the case left your active list.",
      };
    case "note":
      return {
        title: "Note saved",
        description: "Your internal note was attached to the case timeline.",
      };
    case "followUp":
      return {
        title: "Follow-up set",
        description: "A reminder was set — the case will resurface on the follow-up date.",
      };
    default:
      return { title: "Saved", description: "Your change was recorded on the case." };
  }
}

const CLOSED_DIALOGS: ActionDialogs = {
  escalate: false,
  reassign: false,
  note: false,
  followUp: false,
  dismiss: false,
  specialist: false,
  adm: false,
  accept: false,
  schedule: false,
  finish: false,
  move: false,
  cancelSess: false,
  deleteSess: false,
  resolve: false,
};

type ReferralActionVariables = { id: string; action: string; payload: unknown };
type ResolveVariables = {
  id: string;
  next: Parameters<typeof updateReferralStatus>[1];
  summary?: string;
};

function isReferralsData(v: unknown): v is { referrals: GuidanceReferralItem[] } {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { referrals?: unknown }).referrals)
  );
}

/** Instantly patch every cached referrals/alerts list; returns a rollback. */
function patchReferralCaches(
  qc: QueryClient,
  id: string,
  patch: (r: GuidanceReferralItem) => GuidanceReferralItem
): () => void {
  const snapshots: { key: readonly unknown[]; data: unknown }[] = [];
  const targets: { queryKey: readonly string[]; updater: (old: unknown) => unknown }[] = [
    {
      queryKey: ["guidance-referrals"],
      updater: (old: unknown) =>
        isReferralsData(old)
          ? { ...old, referrals: old.referrals.map((r) => (r.id === id ? patch(r) : r)) }
          : old,
    },
    {
      queryKey: ["guidance-alerts"],
      updater: (old: unknown) =>
        Array.isArray(old)
          ? (old as GuidanceReferralItem[]).map((r) =>
              (r as GuidanceReferralItem)?.id === id ? patch(r as GuidanceReferralItem) : r
            )
          : old,
    },
  ];
  for (const t of targets) {
    const entries = qc.getQueriesData({ queryKey: [...t.queryKey] });
    for (const [key, data] of entries) {
      snapshots.push({ key, data });
      qc.setQueryData(key, t.updater(data));
    }
  }
  return () => {
    for (const s of snapshots) qc.setQueryData(s.key, s.data);
  };
}

const nowIso = () => new Date().toISOString();

function applyReferralAction(
  r: GuidanceReferralItem,
  action: string,
  payload: unknown
): GuidanceReferralItem {
  const p = (payload ?? {}) as Record<string, unknown>;
  const base = { ...r, lastActionAt: nowIso(), lastActionType: action };
  switch (action) {
    case "accept":
      return {
        ...base,
        status: "in_progress",
        priority: (p.priority as string) ?? r.priority,
        intakeNotes: (p.intakeNotes as string) ?? r.intakeNotes,
        acceptedAt: nowIso(),
        sessions:
          p.firstSession && typeof (p.firstSession as { scheduledAt?: unknown }).scheduledAt === "string"
            ? [
                ...r.sessions,
                {
                  id: `temp-${Date.now()}`,
                  sessionType: (p.firstSession as { sessionType: GuidanceReferralItem["sessions"][number]["sessionType"] }).sessionType,
                  scheduledAt: (p.firstSession as { scheduledAt: string }).scheduledAt,
                  date: (p.firstSession as { scheduledAt: string }).scheduledAt,
                  venue: ((p.firstSession as { venue?: string }).venue ?? "") as string,
                  status: "scheduled",
                  sessionNotes: "",
                  outcome: "",
                  cancelReason: "",
                  createdAt: nowIso(),
                  completedAt: "",
                  attachments: [],
                },
              ]
            : r.sessions,
      };
    case "escalate":
      return {
        ...base,
        status: "escalated",
        escalationReason: (p.escalationReason as string) ?? r.escalationReason,
        escalatedTo: (p.escalatedTo as string) ?? r.escalatedTo,
      };
    case "dismiss":
      return { ...base, status: "dismissed" };
    case "followUp":
      return {
        ...base,
        status: "follow_up",
        followUpDate: (p.followUpDate as string) ?? r.followUpDate,
      };
    case "note":
      return { ...base, notes: (p.notes as string) ?? r.notes };
    case "schedule": {
      const s = p as { scheduledAt?: string; sessionType?: GuidanceReferralItem["sessions"][number]["sessionType"]; venue?: string };
      if (!s.scheduledAt) return base;
      return {
        ...base,
        sessions: [
          ...r.sessions,
          {
            id: `temp-${Date.now()}`,
            sessionType: s.sessionType ?? "individual",
            scheduledAt: s.scheduledAt,
            date: s.scheduledAt,
            venue: s.venue ?? "",
            status: "scheduled",
            sessionNotes: "",
            outcome: "",
            cancelReason: "",
            createdAt: nowIso(),
            completedAt: "",
            attachments: [],
          },
        ],
      };
    }
    case "finish": {
      const s = p as { sessionId?: string; sessionNotes?: string; outcome?: string };
      return {
        ...base,
        sessions: r.sessions.map((sess) =>
          sess.id === s.sessionId
            ? { ...sess, status: "completed", sessionNotes: (s.sessionNotes as string) ?? sess.sessionNotes, outcome: (s.outcome as string) ?? sess.outcome, completedAt: nowIso() }
            : sess
        ),
      };
    }
    case "move": {
      const s = p as { sessionId?: string; scheduledAt?: string };
      return {
        ...base,
        sessions: r.sessions.map((sess) =>
          sess.id === s.sessionId
            ? { ...sess, scheduledAt: (s.scheduledAt as string) ?? sess.scheduledAt, date: (s.scheduledAt as string) ?? sess.date }
            : sess
        ),
      };
    }
    case "cancelSess": {
      const s = p as { sessionId?: string; cancelReason?: string };
      return {
        ...base,
        sessions: r.sessions.map((sess) =>
          sess.id === s.sessionId
            ? { ...sess, status: "cancelled", cancelReason: (s.cancelReason as string) ?? sess.cancelReason }
            : sess
        ),
      };
    }
    case "deleteSess": {
      const s = p as { sessionId?: string };
      return { ...base, sessions: r.sessions.filter((sess) => sess.id !== s.sessionId) };
    }
    default:
      return base;
  }
}

export function useGuidanceReferralActions(referrals: GuidanceReferralItem[]) {
  const [dialogs, setDialogs] = useState<ActionDialogs>({ ...CLOSED_DIALOGS });
  const [form, setForm] = useState<ActionFormState>(INITIAL_GUIDANCE_FORM);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Short double-submit guard — released when the mutation settles
  // (not after refetch). UI/toast no longer wait for refetch.
  const [settling, setSettling] = useState(false);

  const openDialog = (id: string, dialog: keyof ActionDialogs) => {
    setActiveId(id);
    setActiveSessionId(null);
    setForm(INITIAL_GUIDANCE_FORM);
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const openSessionDialog = (
    referralId: string,
    session: { id: string; scheduledAt: string; sessionType: string },
    dialog: "finish" | "move" | "cancelSess" | "deleteSess"
  ) => {
    setActiveId(referralId);
    setActiveSessionId(session.id);
    setForm({
      ...INITIAL_GUIDANCE_FORM,

      sessDate: dialog === "move" ? toDateInputValue(session.scheduledAt) : "",
      sessTime: dialog === "move" ? toTimeInputValue(session.scheduledAt) : "",

      sessType: dialog === "finish" ? session.sessionType : INITIAL_GUIDANCE_FORM.sessType,
    });
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const closeDialog = (dialog: keyof ActionDialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }));
    if (Object.values(dialogs).every((v) => !v)) setActiveId(null);
  };

  const invalidateGuidance = useGuidanceInvalidate();
  const mutation = useGuidanceMutation<unknown, ResolveVariables>({
    mutationFn: ({ id, next, summary }: ResolveVariables) =>
      updateReferralStatus(id, next, summary),
    sourceId: (variables) => variables.id,
    scopes: ["referrals", "alerts", "notifications"],
    optimisticUpdate: (qc, variables) =>
      patchReferralCaches(qc, variables.id, (r) => ({
        ...r,
        status: "resolved",
        resolutionSummary: variables.summary ?? r.resolutionSummary,
        lastActionAt: nowIso(),
        lastActionType: "resolve",
      })),
    successTitle: "Case closed",
    successDescription: () =>
      "The closing summary was saved and the case left your active list.",
    errorTitle: "Could not close the case",
    errorFallback: "The change did not go through. Check your connection and try again.",
  });
  const actionMutation = useGuidanceMutation<
    unknown,
    { id: string; action: string; payload: unknown }
  >({
    sourceId: (variables) => variables.id,
    scopes: ["referrals", "alerts", "notifications"],
    optimisticUpdate: (qc, variables: ReferralActionVariables) =>
      patchReferralCaches(qc, variables.id, (r) =>
        applyReferralAction(r, variables.action, variables.payload)
      ),
    silentSuccess: true,
    successTitle: "Saved",
    errorFallback: "The action did not go through. Check your connection and try again.",
    onSuccessExtra: (_data, variables) => {
      const message = referralActionMessage(variables.action);
      // UI is already updated optimistically — recompute reminders then pop
      // the sileo toast instantly on server success.
      refreshBookingReminders(true);
      if (message) toast.success(message);
    },
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: string;
      action: string;
      payload: unknown;
    }) => {
      switch (action) {
        case "escalate":
          return escalateReferral(
            id,
            (payload as { escalationReason: string; escalatedTo: string })
              .escalationReason,
            (payload as { escalatedTo: string }).escalatedTo as "principal" | "nurse" | "adm_coordinator"
          );
        case "reassign":
          return reassignReferral(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "guidance_counselor" | "adm_coordinator" | "principal"
          );
        case "note":
          return addReferralNote(id, (payload as { notes: string }).notes);
        case "followUp":
          return flagReferralFollowUp(
            id,
            (payload as { followUpDate: string }).followUpDate
          );
        case "dismiss":
          return dismissReferral(
            id,
            (payload as { reason: string }).reason
          );
        case "specialist":
          return referToSpecialist(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "adm_coordinator" | "principal",
            (payload as { reason: string }).reason
          );
        case "adm":
          return initiateAdm(id, (payload as { reason: string }).reason);
        case "accept": {
          const p = payload as {
            priority: "low" | "normal" | "high";
            intakeNotes?: string;
            firstSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return acceptReferral(id, p);
        }
        case "schedule": {
          const p = payload as {
            scheduledAt: string;
            sessionType: CounselingSessionType;
            venue?: string;
          };
          return scheduleSession(id, p);
        }
        case "finish": {
          const p = payload as {
            sessionId: string;
            sessionNotes: string;
            outcome?: string;
            followUpSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return completeSession(id, p.sessionId, {
            sessionNotes: p.sessionNotes,
            outcome: p.outcome,
            followUpSession: p.followUpSession,
          });
        }
        case "move": {
          const p = payload as { sessionId: string; scheduledAt: string };
          return rescheduleSession(id, p.sessionId, p.scheduledAt);
        }
        case "cancelSess": {
          const p = payload as { sessionId: string; cancelReason?: string };
          return cancelSession(id, p.sessionId, p.cancelReason);
        }
        case "deleteSess": {
          const p = payload as { sessionId: string };
          return deleteSession(id, p.sessionId);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  });

  const handleAction = (action: string, payload: unknown) => {
    if (!activeId) return;
    if (actionMutation.isPending || settling) return;

    // Close instantly — the row itself is already patched optimistically.
    const id = activeId;
    setDialogs({ ...CLOSED_DIALOGS });
    setActiveId(null);
    setActiveSessionId(null);
    setSettling(true);
    actionMutation.mutate(
      { id, action, payload },
      {
        onError: () => {
          // Rollback already applied; restore dialog so user can retry.
          setActiveId(id);
        },
        onSettled: () => {
          setSettling(false);
        },
      }
    );
  };

  const isActionPending = actionMutation.isPending || settling;

  const busyRowId = actionMutation.isPending
    ? ((actionMutation.variables as { id?: string } | undefined)?.id ?? null)
    : null;

  const activeRow = referrals.find((r) => r.id === activeId) ?? null;
  const activeSession =
    activeRow?.sessions.find((s) => s.id === activeSessionId) ?? null;

  const resolveCase = (id: string, summary: string) => {
    if (mutation.isPending || settling) return;
    setDialogs((prev) => ({ ...prev, resolve: false }));
    setActiveId(null);
    setSettling(true);
    mutation.mutate(
      { id, next: "resolved", summary },
      {
        onError: () => {
          setActiveId(id);
        },
        onSettled: () => {
          setSettling(false);
        },
      }
    );
  };

  return {
    dialogs,
    form,
    setForm,
    activeId,
    activeRow,
    activeSession,
    openDialog,
    openSessionDialog,
    closeDialog,
    mutation,
    actionMutation,
    handleAction,
    resolveCase,
    isActionPending,
    busyRowId,
    invalidateGuidance,
  };
}
