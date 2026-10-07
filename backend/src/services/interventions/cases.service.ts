import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import {
  evaluateRisk,
  evaluateRosterRisk,
} from "../risk.js";
import {
  getIntervention,
  isSessionType,
  notifyInterventionAdviser,
  parseScheduledAt,
} from "../../modules/interventions/interventions.repository.js";
import type { InterventionContext } from "./intervention.types.js";

export interface StartInterventionInput {
  studentId?: string;
  rosterId?: string;
  recommendedAction: string;
  priority: "low" | "normal" | "high";
  intakeNotes?: string;
  firstSession?: { scheduledAt: string; sessionType: string; venue?: string };
}

// Start a follow-up for a live at-risk student who has no open one yet —
// same intake as accepting a referral: urgency, first impressions, and an
// optional first counseling session booked on the spot.
export async function startIntervention(
  ctx: InterventionContext,
  input: StartInterventionInput,
  termId: string | null,
) {
  const { studentId, rosterId } = input;
  if ((studentId && rosterId) || (!studentId && !rosterId)) {
    throw new AppError(400, "INVALID_ACTION", "Pick exactly one student");
  }
  if (!termId) throw new AppError(400, "NO_ACTIVE_TERM", "No active term to evaluate");
  let liveLevel: string;
  if (rosterId) {
    const roster = await prisma.studentRoster.findUnique({
      where: { id: rosterId },
      select: { id: true },
    });
    if (!roster) throw new AppError(404, "NOT_FOUND", "Student not found");
    liveLevel = (await evaluateRosterRisk(rosterId, termId)).result.riskLevel;
  } else {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: studentId! },
      select: { userId: true },
    });
    if (!profile) throw new AppError(404, "NOT_FOUND", "Student not found");
    liveLevel = (await evaluateRisk(studentId!, termId)).result.riskLevel;
  }
  if (liveLevel !== "High" && liveLevel !== "Moderate") {
    throw new AppError(400, "INVALID_ACTION", "Only at-risk students need a follow-up");
  }
  const open = await prisma.intervention.findFirst({
    where: {
      ...(studentId ? { studentId } : { rosterId: rosterId! }),
      termId,
      outcomeStatus: { not: "resolved" },
      approvalStatus: { not: "rejected" },
    },
    select: { id: true },
  });
  if (open) {
    throw new AppError(400, "INVALID_ACTION", "This student already has an open follow-up");
  }
  if (input.firstSession && !isSessionType(input.firstSession.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown session type");
  }
  const created = await prisma.intervention.create({
    data: {
      studentId: studentId ?? null,
      rosterId: rosterId ?? null,
      termId,
      riskLevelAtFlag: liveLevel as "High" | "Moderate",
      recommendedAction: input.recommendedAction.trim(),
      priority: input.priority,
      intakeNotes: input.intakeNotes?.trim() || null,
      assignedTo: ctx.userId,
      assignedAt: new Date(),
      approvalStatus: "approved",
      outcomeStatus: "ongoing",
    },
  });
  if (input.firstSession) {
    const first = await prisma.counselingSession.create({
      data: {
        interventionId: created.id,
        sessionType: input.firstSession.sessionType,
        scheduledAt: parseScheduledAt(input.firstSession.scheduledAt),
        venue: input.firstSession.venue?.trim() || null,
        status: "scheduled",
        createdBy: ctx.userId,
      },
    });
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: first.id, reason: "First session booked on follow-up start", oldValue: null, newValue: { sessionType: first.sessionType, scheduledAt: first.scheduledAt } });
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "intervention_assigned",
    sourceTable: "interventions",
    sourceId: created.id,
    reason: `Follow-up started with ${input.priority} priority`,
    oldValue: null,
    newValue: { riskLevelAtFlag: liveLevel },
  });
  notifyInterventionAdviser(created, ctx.userId, (name) => `Guidance opened a follow-up for ${name}.`);
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "session_self",
    message: `You opened a ${liveLevel}-risk follow-up.`,
    sourceId: created.id,
  });
  return created;
}

export interface ReviewInput {
  decision: "approved" | "rejected" | "modified";
  recommendedAction?: string;
}

export async function reviewIntervention(ctx: InterventionContext, interventionId: string, input: ReviewInput) {
  const row = await getIntervention(interventionId, ctx.termId);
  if (row.outcomeStatus === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "A resolved intervention can no longer be reviewed");
  }
  if (input.decision === "modified" && !input.recommendedAction?.trim()) {
    throw new AppError(400, "INVALID_ACTION", "Write the adjusted action when modifying");
  }
  const updated = await prisma.intervention.update({
    where: { id: row.id },
    data: {
      approvalStatus: input.decision,
      ...(input.decision === "modified"
        ? { recommendedAction: input.recommendedAction!.trim() }
        : {}),
    },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "intervention_approval",
    sourceTable: "interventions",
    sourceId: row.id,
    reason: `Review → ${input.decision}`,
    oldValue: { approvalStatus: row.approvalStatus },
    newValue: {
      approvalStatus: input.decision,
      ...(input.decision === "modified"
        ? { recommendedAction: input.recommendedAction!.trim() }
        : {}),
    },
  });
  // Best-effort fan-outs after the confirmed response (never block it).
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "approve",
      sourceId: row.id,
      message: `Your intervention was ${input.decision} by guidance`,
    });
  }
  // Reviewer receipt: bell row for the acting counselor.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "interventions",
    action: "approve",
    sourceId: row.id,
    message: `You ${input.decision} an intervention plan.`,
  });
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance ${input.decision} the intervention plan for ${name}.`
  );
  return updated;
}

export async function assignIntervention(
  ctx: InterventionContext,
  interventionId: string,
  assigneeId: string | null,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  if (row.outcomeStatus === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "A resolved intervention can no longer be reassigned");
  }
  // No hand-offs while a session is still upcoming — finish or cancel it
  // first so the booked session never strands with the wrong handler.
  const upcoming = await prisma.counselingSession.count({
    where: { interventionId: row.id, status: "scheduled" },
  });
  if (upcoming > 0) {
    throw new AppError(400, "ACTIVE_SESSION_EXISTS", "This case has an upcoming session — finish or cancel it before reassigning");
  }
  if (assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user) throw new AppError(404, "NOT_FOUND", "Staff member not found");
  }
  const updated = await prisma.intervention.update({
    where: { id: row.id },
    data: {
      assignedTo: assigneeId,
      assignedAt: assigneeId ? new Date() : null,
    },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "intervention_assigned",
    sourceTable: "interventions",
    sourceId: row.id,
    reason: assigneeId ? "Intervention taken" : "Intervention released",
    oldValue: { assignedTo: row.assignedTo },
    newValue: { assignedTo: assigneeId },
  });
  // Best-effort fan-out after the confirmed response (never blocks it).
  if (assigneeId && assigneeId !== ctx.userId) {
    void fanoutNotification({
      userId: assigneeId,
      sourceTable: "interventions",
      action: "assign",
      sourceId: row.id,
      message: "An intervention was assigned to you by guidance",
    });
  }
  return updated;
}

export interface OutcomeInput {
  outcomeStatus: "ongoing" | "resolved" | "unresolved";
  outcomeNotes?: string;
}

export async function recordOutcome(
  ctx: InterventionContext,
  interventionId: string,
  input: OutcomeInput,
  getRiskTermId: () => Promise<string | null>,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  if (
    (input.outcomeStatus === "resolved" ||
      input.outcomeStatus === "unresolved") &&
    row.approvalStatus === "pending"
  ) {
    throw new AppError(400, "INVALID_ACTION", "Review the recommendation before closing the outcome");
  }
  // No outcome while a session is still upcoming — finish or cancel it
  // first (same rule as endorsing: the booked session decides the case).
  // Strict close-out (same rule as referrals): a finished session plus a
  // closing note are mandatory before a follow-up can be closed — except
  // a discontinue close (unresolved) for a student whose live risk has
  // genuinely cleared to Low: there is nothing left to counsel, so the
  // closing note alone suffices and the case leaves the queue.
  const closing =
    input.outcomeStatus === "resolved" ||
    input.outcomeStatus === "unresolved";
  if (closing) {
    // Independent counts run in parallel.
    const [upcomingCount, doneCount] = await Promise.all([
      prisma.counselingSession.count({
        where: { interventionId: row.id, status: "scheduled" },
      }),
      prisma.counselingSession.count({
        where: { interventionId: row.id, status: "completed" },
      }),
    ]);
    if (upcomingCount > 0) {
      throw new AppError(400, "ACTIVE_SESSION_EXISTS", "This case has an upcoming session — finish or cancel it before recording the outcome");
    }
    if (doneCount === 0) {
      const termId = await getRiskTermId();
      const liveLevel = termId
        ? row.studentId
          ? (await evaluateRisk(row.studentId, termId)).result.riskLevel
          : row.rosterId
            ? (await evaluateRosterRisk(row.rosterId, termId)).result.riskLevel
            : null
        : null;
      if (input.outcomeStatus !== "unresolved" || liveLevel !== "Low") {
        throw new AppError(400, "OUTCOME_BLOCKED", "Finish at least one counseling session before closing this follow-up");
      }
    }
    if (!input.outcomeNotes?.trim()) {
      throw new AppError(400, "OUTCOME_BLOCKED", "A closing note is required to close this follow-up");
    }
  }
  const updated = await prisma.intervention.update({
    where: { id: row.id },
    data: {
      outcomeStatus: input.outcomeStatus,
      outcomeNotes: input.outcomeNotes?.trim() || null,
    },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "intervention_outcome",
    sourceTable: "interventions",
    sourceId: row.id,
    reason: `Outcome → ${input.outcomeStatus}`,
    oldValue: { outcomeStatus: row.outcomeStatus },
    newValue: { outcomeStatus: input.outcomeStatus },
  });
  // Best-effort fan-outs after the confirmed response (never block it).
  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "interventions",
      action: "outcome",
      sourceId: row.id,
      message: `Intervention outcome recorded: ${input.outcomeStatus}`,
    });
  }
  notifyInterventionAdviser(
    row,
    ctx.userId,
    (name) => `Guidance recorded an outcome for ${name}'s follow-up: ${input.outcomeStatus}.`
  );
  return updated;
}
