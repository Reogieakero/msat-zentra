import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { ensureWorkable, formatSession, formatWhen, getIntervention, getInterventionSession, isSessionType, notifyInterventionAdviser, parseScheduledAt, truncate, adviserOf } from "../../modules/interventions/interventions.repository.js";
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

  const { updated, next } = await prisma.$transaction(async (tx) => {
    const done = await tx.counselingSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        sessionNotes: input.sessionNotes.trim(),
        outcome: input.outcome?.trim() || null,
        completedAt: new Date(),
      },
    });
    let created: { id: string; sessionType: string; scheduledAt: Date } | null = null;
    if (input.followUpSession) {
      created = await tx.counselingSession.create({
        data: {
          interventionId: row.id,
          sessionType: input.followUpSession.sessionType,
          scheduledAt: parseScheduledAt(input.followUpSession.scheduledAt),
          venue: input.followUpSession.venue?.trim() || null,
          status: "scheduled",
          createdBy: ctx.userId,
        },
      });
    }
    return { updated: done, next: created };
  });
  await writeAudit({ userId: ctx.userId, actionType: "session_completed", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session completed", oldValue: { status: session.status }, newValue: { status: "completed" } });
  if (next) {
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: next.id, reason: "Follow-up session booked", oldValue: null, newValue: { sessionType: next.sessionType, scheduledAt: next.scheduledAt } });
  }

  if (!next && row.approvalStatus !== "pending") {
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
  const doneWhen = formatWhen(updated.scheduledAt);
  let doneFor = "the student";
  try {
    doneFor = (await adviserOf(row)).studentName;
  } catch {

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
