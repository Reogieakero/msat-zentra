import { actorActionLabel } from "@/lib/notifications/action-label";
import { isEndorsed, isWithdrawn, statusLabel } from "./referral-status";
export type ActivityScope = "guidance" | "nurse" | "teacher";
function newestSessionOf(row: { sessions: { createdAt: string; scheduledAt: string; cancelledByRole?: string | null }[] }): { createdAt: string; scheduledAt: string; cancelledByRole?: string | null } | undefined {
  return [...row.sessions].sort((a, b) => {
    const at = new Date(a.createdAt || a.scheduledAt).getTime();
    const bt = new Date(b.createdAt || b.scheduledAt).getTime();
    if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
    if (Number.isNaN(at)) return 1;
    if (Number.isNaN(bt)) return -1;
    return bt - at;
  })[0];
}
export function labelForActionType(
  actionType: string,
  row: {
    type: string;
    status: string;
    sessions: { createdAt: string; scheduledAt: string; cancelledByRole?: string | null }[];
    dismissedByRole?: string | null;
  },
  opts: { scope: ActivityScope; fallback: string; message?: string; byRole?: string | null }
): string {
  const scope = opts.scope;
  const fallback = opts.fallback;
  const newestSession = newestSessionOf(row);
  if (scope === "nurse") {
    switch (actionType) {
      case "session_scheduled":
      case "session_completed":
      case "session_rescheduled":
      case "session_document_added":
      case "referral_follow_up":
      case "referral_accepted":
      case "referral_escalated":
        return actorActionLabel({ scope: "nurse", action: actionType, fallback });
      case "session_cancelled":
        return actorActionLabel({
          scope: "nurse",
          action: actionType,
          cancelledByRole: newestSession?.cancelledByRole ?? null,
          fallback,
        });
      case "referral_dismissed":
        return actorActionLabel({
          scope: "nurse",
          action: actionType,
          withdrawn: isWithdrawn(row),
          fallback,
        });
      case "referral_status_change":
        if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator by School Nurse";
        if (row.status === "follow_up") return "Marked for follow-up by School Nurse";
        if (row.status === "resolved") return "Resolved by School Nurse";
        if (row.status === "dismissed")
          return actorActionLabel({
            scope: "nurse",
            action: "referral_dismissed",
            withdrawn: isWithdrawn(row),
            fallback,
          });
        return fallback;
      default:
        return fallback;
    }
  }
  if (scope === "teacher") {
    switch (actionType) {
      case "session_scheduled":
      case "session_completed":
      case "session_rescheduled":
      case "session_document_added":
      case "referral_follow_up":
      case "referral_accepted":
      case "referral_reassigned":
      case "referral_note_added":
      case "referral_referred_specialist":
      case "referral_adm_initiated":
        return actorActionLabel({ scope: "teacher", action: actionType, message: opts.message, byRole: opts.byRole ?? null, fallback });
      case "session_cancelled":
        return actorActionLabel({
          scope: "teacher",
          action: actionType,
          cancelledByRole: newestSession?.cancelledByRole ?? null,
          message: opts.message,
          byRole: opts.byRole ?? null,
          fallback,
        });
      case "referral_dismissed":
        return actorActionLabel({
          scope: "teacher",
          action: actionType,
          withdrawn: isWithdrawn(row),
          byRole: opts.byRole ?? null,
          fallback,
        });
      case "referral_escalated":
        return actorActionLabel({ scope: "teacher", action: actionType, message: opts.message, byRole: opts.byRole ?? null, fallback });
      case "referral_status_change":
        if (isEndorsed(row.type, row.status)) return fallback;
        return fallback;
      default:
        return fallback;
    }
  }
  switch (actionType) {
    case "session_scheduled":
    case "session_completed":
    case "session_rescheduled":
    case "session_document_added":
    case "referral_follow_up":
    case "referral_accepted":
    case "referral_reassigned":
    case "referral_note_added":
    case "referral_referred_specialist":
    case "referral_adm_initiated":
      return actorActionLabel({ scope: "guidance", action: actionType, fallback });
    case "session_cancelled":
      return actorActionLabel({
        scope: "guidance",
        action: actionType,
        cancelledByRole: newestSession?.cancelledByRole ?? null,
        fallback,
      });
    case "referral_dismissed":
      return actorActionLabel({
        scope: "guidance",
        action: actionType,
        withdrawn: isWithdrawn(row),
        fallback,
      });
    case "referral_escalated":
      return "Sent to a higher office by Guidance Counselor";
    case "referral_status_change":
      if (isEndorsed(row.type, row.status)) return "Endorsed to ADM coordinator by Guidance Counselor";
      if (row.status === "follow_up") return "Marked for follow-up by Guidance Counselor";
      if (row.status === "resolved") return "Resolved by Guidance Counselor";
      if (row.status === "dismissed")
        return actorActionLabel({
          scope: "guidance",
          action: "referral_dismissed",
          withdrawn: isWithdrawn(row),
          fallback,
        });
      if (row.status === "escalated") return "Sent to a higher office by Guidance Counselor";
      if (row.status === "in_progress") return "Accepted by Guidance Counselor";
      return fallback;
    default:
      return fallback;
  }
}
export function latestActionOf(
  row: {
    type: string;
    status: string;
    sessions: { status: string; scheduledAt: string; createdAt: string; cancelledByRole?: string | null }[];
    lastActionAt: string;
    lastActionType: string;
    followUpDate?: string;
    date: string;
    dismissedByRole?: string | null;
  },
  opts: { scope: ActivityScope; fallback?: string; message?: string; byRole?: string | null }
): { label: string; time: string } {
  const scope = opts.scope;
  if (scope === "nurse") {
    const fallback = opts.fallback ?? "";
    if (row.sessions.length > 0) {
      const sorted = [...row.sessions].sort((a, b) => {
        const at = new Date(a.createdAt || a.scheduledAt).getTime();
        const bt = new Date(b.createdAt || b.scheduledAt).getTime();
        if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
        if (Number.isNaN(at)) return 1;
        if (Number.isNaN(bt)) return -1;
        return bt - at;
      });
      const latest = sorted[0];
      if (latest.status === "completed" && row.followUpDate) {
        return { label: "Marked for follow-up by School Nurse", time: row.followUpDate };
      }
      if (latest.status === "completed") {
        return {
          label: actorActionLabel({ scope: "nurse", action: "session_completed", fallback: "Session done" }),
          time: latest.createdAt || latest.scheduledAt,
        };
      }
      if (latest.status === "cancelled") {
        return {
          label: actorActionLabel({
            scope: "nurse",
            action: "session_cancelled",
            cancelledByRole: latest.cancelledByRole ?? null,
            fallback: "Session cancelled",
          }),
          time: latest.createdAt || latest.scheduledAt,
        };
      }
      return {
        label: actorActionLabel({ scope: "nurse", action: "session_scheduled", fallback: "Session booked" }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    if (row.lastActionAt) {
      return { label: labelForActionType(row.lastActionType, row, { scope: "nurse", fallback }), time: row.lastActionAt };
    }
    if (row.followUpDate) return { label: "Marked for follow-up by School Nurse", time: row.followUpDate };
    if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator by School Nurse", time: row.date };
    if (row.status === "dismissed")
      return {
        label: actorActionLabel({
          scope: "nurse",
          action: "referral_dismissed",
          withdrawn: isWithdrawn(row),
          fallback: "Rejected",
        }),
        time: row.date,
      };
    if (row.status === "resolved") return { label: "Resolved by School Nurse", time: row.date };
    return { label: fallback, time: row.date };
  }
  if (scope === "teacher") {
    const fallback = opts.fallback ?? statusLabel(row.status);
    if (row.lastActionAt) {
      return { label: labelForActionType(row.lastActionType, row, { scope: "teacher", fallback, message: opts.message, byRole: opts.byRole ?? null }), time: row.lastActionAt };
    }
    if (row.sessions.length > 0) {
      const sorted = [...row.sessions].sort((a, b) => {
        const at = new Date(a.createdAt || a.scheduledAt).getTime();
        const bt = new Date(b.createdAt || b.scheduledAt).getTime();
        if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
        if (Number.isNaN(at)) return 1;
        if (Number.isNaN(bt)) return -1;
        return bt - at;
      });
      const latest = sorted[0];
      if (latest.status === "completed") {
        return {
          label: actorActionLabel({ scope: "teacher", action: "session_completed", message: opts.message, fallback: "Session done" }),
          time: latest.createdAt || latest.scheduledAt,
        };
      }
      if (latest.status === "cancelled") {
        return {
          label: actorActionLabel({
            scope: "teacher",
            action: "session_cancelled",
            cancelledByRole: latest.cancelledByRole ?? null,
            message: opts.message,
            fallback: "Session cancelled",
          }),
          time: latest.createdAt || latest.scheduledAt,
        };
      }
      return {
        label: actorActionLabel({ scope: "teacher", action: "session_scheduled", message: opts.message, fallback: "Session booked" }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    return { label: fallback, time: row.date };
  }
  const guidanceFallback = opts.fallback ?? statusLabel(row.status);
  if (row.lastActionAt) {
    return { label: labelForActionType(row.lastActionType, row, { scope: "guidance", fallback: guidanceFallback }), time: row.lastActionAt };
  }
  if (row.sessions.length > 0) {
    const sorted = [...row.sessions].sort((a, b) => {
      const at = new Date(a.createdAt || a.scheduledAt).getTime();
      const bt = new Date(b.createdAt || b.scheduledAt).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const latest = sorted[0];
    if (latest.status === "completed") {
      return {
        label: actorActionLabel({ scope: "guidance", action: "session_completed", fallback: "Session done" }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    if (latest.status === "cancelled") {
      return {
        label: actorActionLabel({
          scope: "guidance",
          action: "session_cancelled",
          cancelledByRole: latest.cancelledByRole ?? null,
          fallback: "Session cancelled",
        }),
        time: latest.createdAt || latest.scheduledAt,
      };
    }
    return {
      label: actorActionLabel({ scope: "guidance", action: "session_scheduled", fallback: "Session booked" }),
      time: latest.createdAt || latest.scheduledAt,
    };
  }
  if (row.followUpDate) return { label: "Marked for follow-up by Guidance Counselor", time: row.followUpDate };
  if (isEndorsed(row.type, row.status)) return { label: "Endorsed to ADM coordinator by Guidance Counselor", time: row.date };
  if (row.status === "dismissed")
    return {
      label: actorActionLabel({
        scope: "guidance",
        action: "referral_dismissed",
        withdrawn: isWithdrawn(row),
        fallback: "Rejected",
      }),
      time: row.date,
    };
  if (row.status === "resolved") return { label: "Resolved by Guidance Counselor", time: row.date };
  if (row.status === "escalated") return { label: "Sent to a higher office by Guidance Counselor", time: row.date };
  return { label: statusLabel(row.status), time: row.date };
}
