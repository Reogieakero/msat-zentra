import { prisma } from "../../lib/prisma.js";

export const TIMELINE_DESK_LABELS: Record<string, string> = {
  adm_coordinator: "ADM Coordinator",
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  principal: "Principal",
};

export function friendlyTimelineStep(
  action: string,
  reason: string | null,
  actorRole?: string | null,
): { label: string; detail: string | null } {
  const note = (reason ?? "").trim();
  const autoText =
    note === "" ||
    note.startsWith("Referred to ") ||
    note.includes("re-submitted") ||
    note === "Referral update";
  const detail = !autoText && note.length >= 5 ? note : null;
  if (action === "referral_dismissed") {
    if (actorRole === "adviser" || actorRole === "subject_teacher" || !actorRole) {
      return { label: "The referral was withdrawn by the filing teacher.", detail };
    }
    return { label: "The referral was rejected and the case is closed.", detail };
  }
  if (action === "referral_status_change") {
    if (note.startsWith("Referred to ")) {
      const roleKey = note.slice("Referred to ".length).split(" ")[0] ?? "";
      const desk = TIMELINE_DESK_LABELS[roleKey] ?? "the receiving desk";
      return { label: `Submitted to the ${desk}.`, detail };
    }
    if (note.includes("re-submitted")) {
      return { label: "Re-submitted — the case is pending again.", detail };
    }
  }
  if (note !== "") {
    const sentence = note.charAt(0).toUpperCase() + note.slice(1);
    return { label: sentence.endsWith(".") ? sentence : `${sentence}.`, detail: null };
  }
  return { label: "Referral update.", detail: null };
}

export function friendlySessionStep(
  action: string,
  reason: string | null,
): { label: string; detail: string | null } {
  const note = (reason ?? "").trim();
  const autoText =
    note === "" ||
    note === "Counseling session scheduled" ||
    note === "First session booked on accept" ||
    note === "Follow-up session booked" ||
    note === "Counseling session completed" ||
    note === "Counseling session cancelled" ||
    note === "Counseling session moved";
  const detail = !autoText && note.length >= 5 ? note : null;
  switch (action) {
    case "session_scheduled":
      return { label: "Session booked.", detail };
    case "session_completed":
      return { label: "Session done.", detail };
    case "session_cancelled":
      return { label: "Session cancelled.", detail };
    case "session_rescheduled":
      return { label: "Session moved.", detail };
    case "session_document_added":
      return { label: "Documentation filed.", detail };
    default:
      return { label: "Session update.", detail };
  }
}

export function friendlyMeetingStep(
  reason: string | null,
): { label: string; detail: string | null; homeVisit: boolean } {
  const note = (reason ?? "").trim();
  const home = note.includes("home visitation") || note.includes("did not attend");
  if (note.startsWith("Parent meeting booked")) {
    return { label: home ? "Home visit booked." : "Parent meeting booked.", detail: null, homeVisit: home };
  }
  if (note.startsWith("Parent meeting rescheduled")) {
    return { label: home ? "Home visit moved." : "Parent meeting moved.", detail: null, homeVisit: home };
  }
  if (note === "Parent meeting attended") {
    return { label: "Parents attended the meeting.", detail: null, homeVisit: false };
  }
  if (note.startsWith("Parents did not attend")) {
    return { label: "Parents did not attend — home visitation path.", detail: null, homeVisit: true };
  }
  const detail = note.length >= 5 ? note : null;
  return { label: "Parent meeting update.", detail, homeVisit: home };
}

export interface CaseTimelineEntry {
  label: string;
  detail: string | null;
  date: string;
  at: string;
  action: string;
  byRole: string | null;
  source: "referrals" | "counseling_sessions" | "adm_parent_meetings" | "case";
  stage?: string | null;
  homeVisit?: boolean;
}

export async function buildCaseTimeline(
  referralIds: string[]
): Promise<Map<string, CaseTimelineEntry[]>> {
  const out = new Map<string, CaseTimelineEntry[]>();
  if (referralIds.length === 0) return out;

  const sessions = await prisma.counselingSession.findMany({
    where: { referralId: { in: referralIds } },
    select: { id: true, referralId: true },
  });
  const sessionToReferral = new Map<string, string>();
  for (const s of sessions) {
    if (s.referralId) sessionToReferral.set(s.id, s.referralId);
  }
  const sessionIds = [...sessionToReferral.keys()];

  const meetings = await prisma.admParentMeeting.findMany({
    where: { referralId: { in: referralIds } },
    select: { id: true, referralId: true },
  });
  const meetingToReferral = new Map<string, string>();
  for (const m of meetings) {
    if (m.referralId) meetingToReferral.set(m.id, m.referralId);
  }
  const meetingIds = [...meetingToReferral.keys()];

  const [referralLogs, sessionLogs, meetingLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { sourceTable: "referrals", sourceId: { in: referralIds } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        sourceTable: "counseling_sessions",
        sourceId: { in: sessionIds.length > 0 ? sessionIds : ["__none__"] },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        sourceTable: "adm_parent_meetings",
        sourceId: { in: meetingIds.length > 0 ? meetingIds : ["__none__"] },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const actorIds = [
    ...new Set(
      [...referralLogs, ...sessionLogs, ...meetingLogs].map((l) => l.userId).filter(Boolean)
    ),
  ];
  const actorRoles = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, role: true },
    });
    for (const a of actors) actorRoles.set(a.id, String(a.role));
  }

  const push = (
    referralId: string,
    source: CaseTimelineEntry["source"],
    entry: { createdAt: Date; reason: string | null; action: string; byRole: string | null },
    friendly: { label: string; detail: string | null; homeVisit?: boolean; stage?: string | null }
  ) => {
    const list = out.get(referralId) ?? [];
    list.push({
      ...friendly,
      date: entry.createdAt.toISOString().slice(0, 10),
      at: entry.createdAt.toISOString(),
      action: entry.action,
      byRole: entry.byRole,
      source,
    });
    out.set(referralId, list);
  };

  for (const log of referralLogs) {
    const typed = log as { reason?: string | null; actionType?: string };
    const byRole = actorRoles.get(log.userId) ?? null;
    push(
      log.sourceId,
      "referrals",
      {
        createdAt: log.createdAt,
        reason: typed.reason ?? null,
        action: typed.actionType ?? "",
        byRole,
      },
      friendlyTimelineStep(typed.actionType ?? "", typed.reason ?? null, byRole)
    );
  }
  for (const log of sessionLogs) {
    const referralId = sessionToReferral.get(log.sourceId);
    if (!referralId) continue;
    const typed = log as { reason?: string | null; actionType?: string };
    push(
      referralId,
      "counseling_sessions",
      {
        createdAt: log.createdAt,
        reason: typed.reason ?? null,
        action: typed.actionType ?? "",
        byRole: actorRoles.get(log.userId) ?? null,
      },
      friendlySessionStep(typed.actionType ?? "", typed.reason ?? null)
    );
  }
  for (const log of meetingLogs) {
    const referralId = meetingToReferral.get(log.sourceId);
    if (!referralId) continue;
    const typed = log as { reason?: string | null; actionType?: string };
    const step = friendlyMeetingStep(typed.reason ?? null);
    push(
      referralId,
      "adm_parent_meetings",
      {
        createdAt: log.createdAt,
        reason: typed.reason ?? null,
        action: typed.actionType ?? "",
        byRole: actorRoles.get(log.userId) ?? null,
      },
      { label: step.label, detail: step.detail, homeVisit: step.homeVisit }
    );
  }

  for (const list of out.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }
  return out;
}
