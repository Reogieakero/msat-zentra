import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { fanoutNotification } from "../../lib/notify.js";

// Shared intervention data-access: labels, cache tags, session guards and
// formatters, intervention getters, and the adviser handoff used by every
// follow-up mutation. Endpoint orchestration lives in
// src/services/interventions/*.service.ts.

export const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const INTERVENTION_WRITE_TAGS = [
  "guidance",
  "guidance-interventions",
  "guidance-risk",
  "overview",
  "alerts",
  "referrals",
  "risk",
  "teacher",
  "adm",
  "nurse",
  "nurse-overview",
  "nurse-alerts",
  "nurse-referrals",
  "nurse-clinic",
  "nurse-adm",
  "nurse-risk",
];

export const SESSION_TYPES = ["individual", "parent_conference", "group", "home_visit"] as const;

export function isSessionType(value: unknown): boolean {
  return typeof value === "string" && (SESSION_TYPES as readonly string[]).includes(value);
}

export function parseScheduledAt(value: unknown): Date {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
  }
  return date;
}

export function formatSession(row: {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: row.id,
    sessionType: row.sessionType,
    scheduledAt: row.scheduledAt.toISOString(),
    date: row.scheduledAt.toISOString().slice(0, 10),
    venue: row.venue ?? "",
    status: row.status,
    sessionNotes: row.sessionNotes ?? "",
    outcome: row.outcome ?? "",
    cancelReason: row.cancelReason ?? "",
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : "",
  };
}

export function formatSessionDoc(row: {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
}) {
  return {
    id: row.id,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

/* "Oct 1, 2026, 9:30 AM" in Asia/Manila — same clock as the referral
   desk fanouts so session times read identically everywhere. */
export function formatWhen(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function truncate(text: string | null | undefined, max = 100): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

export async function getIntervention(id: string, scopeTermId?: string | null) {
  const row = await prisma.intervention.findUnique({
    where: { id },
    include: { assignee: { select: { id: true, fullName: true } } },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Intervention not found");
  // Prior-term follow-ups are read-only history — reads/writes stay in the
  // active term so the desk never leaks cases across terms.
  if (scopeTermId && row.termId !== scopeTermId) {
    throw new AppError(404, "NOT_FOUND", "Intervention not found in the active term");
  }
  return row;
}

/* Section adviser behind an intervention — same resolution as the engine
   detection handoff (student/roster section). Used so every follow-up
   action reaches the adviser live, not just the case owner. */
export async function adviserOf(row: {
  studentId: string | null;
  rosterId: string | null;
}): Promise<{ adviserId: string | null; studentName: string }> {
  if (row.studentId) {
    const s = await prisma.studentProfile.findUnique({
      where: { userId: row.studentId },
      select: {
        user: { select: { fullName: true } },
        section: { select: { adviserId: true } },
      },
    });
    if (!s) return { adviserId: null, studentName: "the student" };
    return { adviserId: s.section?.adviserId ?? null, studentName: s.user.fullName };
  }
  if (row.rosterId) {
    const r = await prisma.studentRoster.findUnique({
      where: { id: row.rosterId },
      select: { fullName: true, section: { select: { adviserId: true } } },
    });
    if (!r) return { adviserId: null, studentName: "the student" };
    return { adviserId: r.section?.adviserId ?? null, studentName: r.fullName };
  }
  return { adviserId: null, studentName: "the student" };
}

/* Adviser handoff for every follow-up mutation (background, off the
   critical path): the section adviser learns live via sileo + bell + badge
   on their desk's realtime channel. Skipped when there is no adviser, the
   adviser acted themselves, or they already got the owner fanout — never a
   double row. Best-effort, never throws. */
export function notifyInterventionAdviser(
  row: { id: string; studentId: string | null; rosterId: string | null; assignedTo: string | null },
  actorId: string,
  message: (studentName: string) => string,
) {
  void (async () => {
    try {
      const { adviserId, studentName } = await adviserOf(row);
      if (!adviserId || adviserId === actorId || adviserId === row.assignedTo) return;
      await fanoutNotification({
        userId: adviserId,
        sourceTable: "interventions",
        action: "session",
        message: message(studentName),
        sourceId: row.id,
      });
    } catch {
      // Best-effort — the confirmed response already went out.
    }
  })();
}

export function ensureWorkable(row: { outcomeStatus: string; approvalStatus: string }) {
  if (row.outcomeStatus === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "A resolved follow-up can no longer be changed");
  }
  if (row.approvalStatus === "rejected") {
    throw new AppError(400, "INVALID_ACTION", "A rejected plan cannot take sessions");
  }
}

export async function getInterventionSession(interventionId: string, sessionId: string) {
  const session = await prisma.counselingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.interventionId !== interventionId) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return session;
}

// Documentation unlocks once the session time arrives — upcoming sessions
// can still be viewed but cannot take new files yet.
export function ensureDocsUnlocked(session: { status: string; scheduledAt: Date }) {
  if (session.status === "scheduled" && session.scheduledAt.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This session hasn't started yet — documentation unlocks once the scheduled time arrives"
    );
  }
}
