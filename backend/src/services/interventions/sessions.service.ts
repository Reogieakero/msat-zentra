import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import {
  ensureDocsUnlocked,
  ensureWorkable,
  formatSession,
  formatSessionDoc,
  formatWhen,
  getIntervention,
  getInterventionSession,
  isSessionType,
  notifyInterventionAdviser,
  parseScheduledAt,
  truncate,
  adviserOf,
} from "../../modules/interventions/interventions.repository.js";
import type { InterventionContext } from "./intervention.types.js";

export interface BookSessionInput {
  scheduledAt: string;
  sessionType: string;
  venue?: string;
}

export async function bookSession(
  ctx: InterventionContext,
  interventionId: string,
  input: BookSessionInput,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  ensureWorkable(row);
  if (!isSessionType(input.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown session type");
  }
  const created = await prisma.counselingSession.create({
    data: {
      interventionId: row.id,
      sessionType: input.sessionType,
      scheduledAt: parseScheduledAt(input.scheduledAt),
      venue: input.venue?.trim() || null,
      status: "scheduled",
      createdBy: ctx.userId,
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
  const when = formatWhen(created.scheduledAt);
  const venue = created.venue?.trim() ? ` at ${created.venue.trim()}` : "";
  let bookedFor = "the student";
  try {
    bookedFor = (await adviserOf(row)).studentName;
  } catch {
    // Default stands — the fanout below still lands.
  }
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "session",
      message: `Guidance booked an intervention session for ${bookedFor} (${created.sessionType}, ${when}${venue}).`,
      sourceId: row.id,
    });
  }
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance booked an intervention session for ${name} (${created.sessionType}, ${when}${venue}).`
  );
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "session_self",
    message: `You booked an intervention session (${created.sessionType}, ${when}${venue}).`,
    sourceId: row.id,
  });
  return formatSession(created);
}

export interface CompleteSessionInput {
  sessionNotes: string;
  outcome?: string;
  followUpSession?: { scheduledAt: string; sessionType: string; venue?: string };
}

export async function completeSession(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  input: CompleteSessionInput,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  ensureWorkable(row);
  const session = await getInterventionSession(row.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be marked done");
  }
  if (input.followUpSession && !isSessionType(input.followUpSession.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
  }
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      sessionNotes: input.sessionNotes.trim(),
      outcome: input.outcome?.trim() || null,
      completedAt: new Date(),
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_completed", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session completed", oldValue: { status: session.status }, newValue: { status: "completed" } });
  if (input.followUpSession) {
    const next = await prisma.counselingSession.create({
      data: {
        interventionId: row.id,
        sessionType: input.followUpSession.sessionType,
        scheduledAt: parseScheduledAt(input.followUpSession.scheduledAt),
        venue: input.followUpSession.venue?.trim() || null,
        status: "scheduled",
        createdBy: ctx.userId,
      },
    });
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: next.id, reason: "Follow-up session booked", oldValue: null, newValue: { sessionType: next.sessionType, scheduledAt: next.scheduledAt } });
    // Auto-close: the final session is done, no next one was booked, and the
    // plan was already reviewed — the session notes become the closing record.
    // NOTE (existing behavior preserved): this branch sits inside
    // `if (followUpSession)`, so `!followUpSession` below is always false
    // and auto-close never fires — likely a latent bug (flagged in the
    // refactor report; not changed here).
    if (!input.followUpSession && row.approvalStatus !== "pending") {
      const remaining = await prisma.counselingSession.count({
        where: { interventionId: row.id, status: "scheduled" },
      });
      if (remaining === 0) {
        const closedOn = (updated.completedAt ?? new Date()).toISOString().slice(0, 10);
        const record = [
          `Automatically closed after the final session on ${closedOn}.`,
          updated.outcome ? `Outcome: ${updated.outcome}` : "",
          updated.sessionNotes ? `Last session notes: ${updated.sessionNotes}` : "",
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 2000);
        await prisma.intervention.update({
          where: { id: row.id },
          data: { outcomeStatus: "resolved", outcomeNotes: record },
        });
        await writeAudit({ userId: ctx.userId, actionType: "intervention_outcome", sourceTable: "interventions", sourceId: row.id, reason: "Auto-closed: final session done, no follow-up booked", oldValue: { outcomeStatus: row.outcomeStatus }, newValue: { outcomeStatus: "resolved" } });
      }
    }
  }
  const doneWhen = formatWhen(updated.scheduledAt);
  let doneFor = "the student";
  try {
    doneFor = (await adviserOf(row)).studentName;
  } catch {
    // Default stands — the fanout below still lands.
  }
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "session",
      message: `Guidance completed an intervention session for ${doneFor} (${updated.sessionType}, ${doneWhen}).`,
      sourceId: row.id,
    });
  }
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance completed an intervention session for ${name} (${updated.sessionType}, ${doneWhen}).`
  );
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "session_self",
    message: `You completed an intervention session (${updated.sessionType}, ${doneWhen}).`,
    sourceId: row.id,
  });
  return formatSession(updated);
}

export async function rescheduleSession(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  scheduledAt: string,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  ensureWorkable(row);
  const session = await getInterventionSession(row.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be moved");
  }
  const nextDate = parseScheduledAt(scheduledAt);
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: { scheduledAt: nextDate },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_rescheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session moved", oldValue: { scheduledAt: session.scheduledAt }, newValue: { scheduledAt: nextDate } });
  const wasMoved = formatWhen(session.scheduledAt);
  const nowMoved = formatWhen(nextDate);
  let movedFor = "the student";
  try {
    movedFor = (await adviserOf(row)).studentName;
  } catch {
    // Default stands — the fanout below still lands.
  }
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "session",
      message: `Guidance rescheduled an intervention session for ${movedFor} — now ${nowMoved} (was ${wasMoved}).`,
      sourceId: row.id,
    });
  }
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance rescheduled an intervention session for ${name} — now ${nowMoved} (was ${wasMoved}).`
  );
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "session_self",
    message: `You rescheduled an intervention session — now ${nowMoved} (was ${wasMoved}).`,
    sourceId: row.id,
  });
  return formatSession(updated);
}

export async function cancelSession(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  cancelReason?: string,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  ensureWorkable(row);
  const session = await getInterventionSession(row.id, sessionId);
  if (session.status !== "scheduled") {
    throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be cancelled");
  }
  const updated = await prisma.counselingSession.update({
    where: { id: session.id },
    data: {
      status: "cancelled",
      cancelReason: cancelReason?.trim() || null,
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: session.id, reason: cancelReason?.trim() || "Counseling session cancelled", oldValue: { status: session.status }, newValue: { status: "cancelled" } });
  const wasDropped = formatWhen(session.scheduledAt);
  const whyDropped = truncate(cancelReason, 120);
  let droppedFor = "the student";
  try {
    droppedFor = (await adviserOf(row)).studentName;
  } catch {
    // Default stands — the fanout below still lands.
  }
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "session",
      message: `Guidance cancelled an intervention session for ${droppedFor} (${session.sessionType}, ${wasDropped})${whyDropped ? ` — ${whyDropped}` : ""}.`,
      sourceId: row.id,
    });
  }
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance cancelled an intervention session for ${name} (${session.sessionType}, ${wasDropped})${whyDropped ? ` — ${whyDropped}` : ""}.`
  );
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "session_self",
    message: `You cancelled an intervention session (${session.sessionType}, ${wasDropped}).`,
    sourceId: row.id,
  });
  return formatSession(updated);
}

export async function listSessions(ctx: InterventionContext, interventionId: string) {
  const row = await getIntervention(interventionId, ctx.termId);
  const sessions = await prisma.counselingSession.findMany({
    where: { interventionId: row.id },
    orderBy: { scheduledAt: "asc" },
  });
  return sessions.map(formatSession);
}

// Session documentary: list / upload / remove image attachments on one
// counseling session. Filing is optional — these operations never gate Done,
// they only build the evidence trail. Uploads are allowed on open cases (any
// session status except a closed follow-up) so documentation can be filed
// after marking a session done — but a still-upcoming session unlocks only
// once its scheduled time arrives.
export async function listAttachments(ctx: InterventionContext, interventionId: string, sessionId: string) {
  const row = await getIntervention(interventionId, ctx.termId);
  const session = await getInterventionSession(row.id, sessionId);
  const rows = await prisma.clinicSessionAttachment.findMany({
    where: { sessionId: session.id },
    orderBy: { uploadedAt: "asc" },
  });
  return rows.map(formatSessionDoc);
}

export interface SessionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  files: SessionFile[],
) {
  const row = await getIntervention(interventionId, ctx.termId);
  // Resolved follow-ups stay open for late documentary filing;
  // discontinued ones do not accumulate further evidence.
  if (row.outcomeStatus === "unresolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a discontinued follow-up");
  }
  const session = await getInterventionSession(row.id, sessionId);
  ensureDocsUnlocked(session);
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.clinicSessionAttachment.count({
    where: { sessionId: session.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
  }
  const created = await Promise.all(
    files.map(async (file) => {
      const path = clinicSessionObjectPath(session.id, file.originalname);
      const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
      return prisma.clinicSessionAttachment.create({
        data: {
          sessionId: session.id,
          fileUrl,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: ctx.userId,
        },
      });
    })
  );
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });
  // Previously silent: owner + actor both learn documentation landed.
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "session_attachments",
      action: "create",
      message: "Session documentation was added to your follow-up.",
      sourceId: row.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "create_self",
    message: "You added session photos to a follow-up.",
    sourceId: row.id,
  });
  return created.map(formatSessionDoc);
}

export async function removeAttachment(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  attachmentId: string,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  if (row.outcomeStatus === "unresolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a discontinued follow-up");
  }
  const session = await getInterventionSession(row.id, sessionId);
  const doc = await prisma.clinicSessionAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!doc || doc.sessionId !== session.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.clinicSessionAttachment.delete({ where: { id: doc.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `Documentation removed: ${doc.fileName}`,
    oldValue: { fileName: doc.fileName },
    newValue: null,
  });
  // Previously silent: owner + actor both learn documentation was removed.
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "session_attachments",
      action: "delete",
      message: "Session documentation was removed from your follow-up.",
      sourceId: row.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "delete_self",
    message: "You removed a session photo from a follow-up.",
    sourceId: row.id,
  });
  return { ok: true };
}
