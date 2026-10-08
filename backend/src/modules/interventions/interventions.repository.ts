import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { fanoutNotification } from "../../lib/notify.js";
import { GRADE_LABELS } from "../../lib/grades.js";

export { GRADE_LABELS };

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

  if (scopeTermId && row.termId !== scopeTermId) {
    throw new AppError(404, "NOT_FOUND", "Intervention not found in the active term");
  }
  return row;
}

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

export function ensureDocsUnlocked(session: { status: string; scheduledAt: Date }) {
  if (session.status === "scheduled" && session.scheduledAt.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This session hasn't started yet — documentation unlocks once the scheduled time arrives"
    );
  }
}
