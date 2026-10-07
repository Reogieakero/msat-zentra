import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import {
  actorName,
  assertActiveTerm,
  ensureNoActiveSession,
  formatSession,
  formatWhen,
  getGuidanceReferral,
  getNurseAdmConsultation,
  isSessionType,
  parseScheduledAt,
  referralCard,
  truncate,
} from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

// Flatten the referral form fill-up into one notes block so the coordinator
// receives the nurse's concerns, details, actions taken, and follow-up plan
// with the case. Returns the bare parts (no prefix) so each caller can label
// the block for its own step — save labels it endorsed, the legacy review
// labels it a referral. Returns null when the form carries no answers.
function buildAdmReferralFormNote(formInput: {
  concerns?: unknown;
  detailsOfConcern?: unknown;
  nurseActions?: unknown;
  followUp?: unknown;
} | undefined): string | null {
  if (!formInput) return null;
  const parts: string[] = [];
  if (Array.isArray(formInput.concerns)) {
    const list = formInput.concerns
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim())
      .slice(0, 10);
    if (list.length > 0) parts.push(`Concerns: ${list.join(", ")}`);
  }
  if (typeof formInput.detailsOfConcern === "string" && formInput.detailsOfConcern.trim()) {
    parts.push(`Details: ${formInput.detailsOfConcern.trim()}`);
  }
  if (typeof formInput.nurseActions === "string" && formInput.nurseActions.trim()) {
    parts.push(`Actions taken: ${formInput.nurseActions.trim()}`);
  }
  if (typeof formInput.followUp === "string" && formInput.followUp.trim()) {
    parts.push(`Follow-up: ${formInput.followUp.trim()}`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

// Book the optional clinic session that can accompany the nurse's ADM work
// (same bargain as the clinic "accept with first session" flow). Returns the
// parsed date, or null when no session was requested.
function parseNurseAdmSession(clinicInput: { scheduledAt?: unknown; venue?: unknown } | undefined): Date | null {
  if (!clinicInput) return null;
  const sessionAt = parseScheduledAt(clinicInput.scheduledAt);
  if (sessionAt.getTime() <= Date.now()) {
    throw new AppError(400, "INVALID_ACTION", "Clinic session must be set in the future");
  }
  return sessionAt;
}

async function createNurseAdmSession(
  referralId: string,
  nurseId: string,
  sessionAt: Date,
  clinicInput: { venue?: unknown } | undefined,
  reason: string,
) {
  // One active session per referral — even ADM-side bookings wait until the
  // existing scheduled session is done or cancelled.
  await ensureNoActiveSession(referralId);
  const venue =
    clinicInput && typeof clinicInput.venue === "string" && clinicInput.venue.trim()
      ? clinicInput.venue.trim()
      : "School clinic";
  const session = await prisma.counselingSession.create({
    data: {
      referralId,
      sessionType: "individual",
      scheduledAt: sessionAt,
      venue,
      status: "scheduled",
      createdBy: nurseId,
    },
    include: { creator: { select: { fullName: true } } },
  });
  await writeAudit({ userId: nurseId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
  return session;
}

export async function referSpecialist(
  ctx: ReferralContext,
  referralId: string,
  referredToRole: "nurse" | "adm_coordinator" | "principal",
  reason: string,
) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot refer a resolved referral");
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { referredToRole: referredToRole as never, reason, status: "pending" },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_referred_specialist", sourceTable: "referrals", sourceId: referral.id, reason, oldValue: { referredToRole: referral.referredToRole, status: referral.status }, newValue: { referredToRole, status: "pending" } });
  const card = await referralCard(referral);
  const why = truncate(reason, 120);
  const actor = await actorName(ctx.userId);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    const dest =
      referredToRole === "nurse"
        ? "the clinic"
        : referredToRole === "adm_coordinator"
          ? "ADM"
          : "the principal";
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} sent your referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  if (referredToRole === "nurse") {
    void fanoutToRole("nurse", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was referred to the clinic — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
    });
  } else if (referredToRole === "adm_coordinator") {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message: `A case was referred to ADM — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
    });
  }
  // Counselor receipt: bell row for the acting counselor.
  {
    const dest =
      referredToRole === "nurse"
        ? "the clinic"
        : referredToRole === "adm_coordinator"
          ? "ADM"
          : "the principal";
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You sent a referral for ${card.who} to ${dest}.`,
      sourceId: referral.id,
    });
  }
  return updated;
}

export async function initiateAdm(ctx: ReferralContext, referralId: string, reason: string) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot initiate ADM on a resolved referral");
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { referredToRole: "adm_coordinator", reason, status: "pending" },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_adm_initiated", sourceTable: "referrals", sourceId: referral.id, reason, oldValue: { referredToRole: referral.referredToRole, status: referral.status }, newValue: { referredToRole: "adm_coordinator", status: "pending" } });
  const card = await referralCard(referral);
  const why = truncate(reason, 120);
  const actor = await actorName(ctx.userId);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `${actor} sent your referral for ${card.who} to ADM.`,
      sourceId: referral.id,
    });
  }
  void fanoutToRole("adm_coordinator", {
    sourceTable: "referrals",
    action: "status",
    message: `A case was referred to ADM — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
    sourceId: referral.id,
    excludeUserId: ctx.userId,
    messageFor: (r) =>
      `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
  });
  // Counselor receipt: bell row for the acting counselor.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You sent a referral for ${card.who} to ADM.`,
    sourceId: referral.id,
  });
  return updated;
}

export interface AcceptGuidanceInput {
  priority: "low" | "normal" | "high";
  intakeNotes?: string;
  firstSession?: { scheduledAt: string; sessionType: string; venue?: string };
}

// Accept a case WITH intake: priority triage, first impressions, and an
// optional first counseling session booked on the spot.
export async function acceptGuidance(ctx: ReferralContext, referralId: string, input: AcceptGuidanceInput) {
  const referral = await getGuidanceReferral(referralId, ctx.termId);
  if (referral.status !== "pending") {
    throw new AppError(400, "INVALID_ACTION", "Only a new case can be accepted");
  }
  if (input.firstSession && !isSessionType(input.firstSession.sessionType)) {
    throw new AppError(400, "INVALID_ACTION", "Unknown session type");
  }
  const firstAt = input.firstSession
    ? parseScheduledAt(input.firstSession.scheduledAt)
    : null;
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: "in_progress",
      priority: input.priority,
      intakeNotes: input.intakeNotes?.trim() ? input.intakeNotes.trim() : null,
      acceptedAt: new Date(),
    },
  });
  if (input.firstSession && firstAt) {
    const created = await prisma.counselingSession.create({
      data: {
        referralId: referral.id,
        sessionType: input.firstSession.sessionType,
        scheduledAt: firstAt,
        venue: input.firstSession.venue?.trim() || null,
        status: "scheduled",
        createdBy: ctx.userId,
      },
    });
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: `First session booked on accept`, oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
  }
  await writeAudit({ userId: ctx.userId, actionType: "referral_accepted", sourceTable: "referrals", sourceId: referral.id, reason: `Accepted with ${input.priority} priority`, oldValue: { status: referral.status }, newValue: { status: "in_progress", priority: input.priority } });
  const card = await referralCard(referral);
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `Guidance accepted your referral for ${card.who} — now in progress${input.firstSession ? " with a first session booked" : ""}.`,
      sourceId: referral.id,
    });
  }
  // Counselor receipt: bell row for the acting counselor (not just the
  // local success toast) so their inbox reflects what they did.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You accepted a guidance referral for ${card.who} — now in progress.`,
    sourceId: referral.id,
  });
  return updated;
}

export interface AcceptNurseInput {
  intakeNotes?: string;
  clinicSession?: { scheduledAt: string; venue?: string };
}

// Nurse intake: accept a case on the clinic's desk WITH first impressions
// and an optional first clinic session booked on the spot — one atomic
// call so a case is never half-accepted.
export async function acceptNurse(ctx: ReferralContext, referralId: string, input: AcceptNurseInput) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  assertActiveTerm(referral, ctx.termId);
  // "Start handling" is for clinic matters only — ADM-track cases follow
  // the consultation review pipeline instead.
  if (referral.referredToRole === "adm_coordinator") {
    throw new AppError(
      400,
      "USE_ADM_REVIEW",
      "ADM cases move through consultation review — use the ADM review action"
    );
  }
  const onNurseDesk =
    referral.referredToRole === "nurse" ||
    (referral.status === "escalated" && referral.escalatedTo === "nurse");
  if (!onNurseDesk) {
    throw new AppError(403, "FORBIDDEN", "Not routed to the clinic");
  }
  if (
    referral.status !== "pending" &&
    !(referral.status === "escalated" && referral.escalatedTo === "nurse")
  ) {
    throw new AppError(400, "INVALID_ACTION", "Only a new case can be accepted");
  }
  let sessionAt: Date | null = null;
  if (input.clinicSession) {
    sessionAt = parseScheduledAt(input.clinicSession.scheduledAt);
    if (sessionAt.getTime() <= Date.now()) {
      throw new AppError(400, "INVALID_ACTION", "Clinic session must be set in the future");
    }
  }
  // Atomic accept: referral flip + first session in one transaction so
  // a case is never half-accepted, and the active-session check runs
  // inside the transaction to close the rapid double-click race.
  const { updated, session } = await prisma.$transaction(async (tx) => {
    if (sessionAt) {
      const active = await tx.counselingSession.count({
        where: { referralId: referral.id, status: "scheduled" },
      });
      if (active > 0) {
        throw new AppError(
          400,
          "ACTIVE_SESSION_EXISTS",
          "This referral already has a session that is not done yet — finish or cancel it before booking another one"
        );
      }
    }
    const updatedRow = await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: "in_progress",
        intakeNotes: input.intakeNotes?.trim() ? input.intakeNotes.trim() : null,
        acceptedAt: new Date(),
      },
    });
    let sessionRow = null;
    if (sessionAt) {
      sessionRow = await tx.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: sessionAt,
          venue: input.clinicSession?.venue?.trim() || "School clinic",
          status: "scheduled",
          createdBy: ctx.userId,
        },
        include: { creator: { select: { fullName: true } } },
      });
    }
    return { updated: updatedRow, session: sessionRow };
  });
  if (session) {
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `First clinic session booked on accept`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
  }
  await writeAudit({ userId: ctx.userId, actionType: "referral_accepted", sourceTable: "referrals", sourceId: referral.id, reason: `Accepted by the clinic${session ? " with a clinic session booked" : ""}`, oldValue: { status: referral.status }, newValue: { status: "in_progress" } });
  const card = await referralCard(referral);
  const sessionBit = session
    ? ` with a first session ${formatWhen(session.scheduledAt)} at ${session.venue || "School clinic"}`
    : "";
  // The referring adviser learns the clinic picked the case up.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `The clinic accepted your referral for ${card.who} — now in progress${sessionBit}.`,
      sourceId: referral.id,
    });
  }
  // Nurse receipt: bell row for the acting nurse (not just the local
  // success toast) so their inbox reflects what they did.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You accepted a clinic referral for ${card.who} — now in progress${sessionBit}.`,
    sourceId: referral.id,
  });
  return { referral: updated, clinicSession: session ? formatSession(session) : null };
}

export interface NurseAdmReviewInput {
  recommendation: string;
  outcome: "endorse" | "reject";
  clinicSession?: { scheduledAt?: unknown; venue?: unknown };
  referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown };
}

// Nurse consultation review on an ADM-purpose referral sitting at the
// consultation stage with no learner profile yet:
//   - endorse: consultation done, case moves to in_progress for the ADM
//     coordinator's parent meeting.
//   - reject: the filing doesn't warrant ADM, case closes as dismissed.
export async function nurseAdmReview(ctx: ReferralContext, referralId: string, input: NurseAdmReviewInput) {
  const referral = await getNurseAdmConsultation(referralId, ctx.termId);
  if (referral.status !== "pending") {
    throw new AppError(400, "INVALID_ACTION", "Only a new case can be reviewed");
  }
  const { recommendation, outcome } = input;
  // Forwarding requires the completed referral form — a case never moves
  // to the coordinator without it. The form is completed on the dedicated
  // form page (nurse-referral-form); this gate closes direct-call bypasses.
  if (outcome === "endorse" && !referral.referralFormReady) {
    throw new AppError(
      400,
      "FORM_NOT_READY",
      "Complete the referral form before forwarding this case"
    );
  }
  const sessionAt = input.clinicSession && outcome === "endorse" ? parseNurseAdmSession(input.clinicSession) : null;
  const note = `[ADM consult] ${recommendation.trim()}`;
  const formParts = input.referralForm && outcome === "endorse" ? buildAdmReferralFormNote(input.referralForm) : null;
  const formNote = formParts ? `[ADM referral] ${formParts}` : null;
  const notesWithReview = referral.notes ? `${referral.notes}\n${note}` : note;
  const notesWithForm = formNote ? `${notesWithReview}\n${formNote}` : notesWithReview;
  // Atomic review: status flip + optional session in one transaction.
  const { updated, session } = await prisma.$transaction(async (tx) => {
    const updatedRow = await tx.referral.update({
      where: { id: referral.id },
      data:
        outcome === "endorse"
          ? {
              status: "in_progress",
              notes: notesWithForm,
            }
          : {
              status: "dismissed",
              notes: notesWithReview,
            },
    });
    let sessionRow = null;
    if (sessionAt) {
      const active = await tx.counselingSession.count({
        where: { referralId: referral.id, status: "scheduled" },
      });
      if (active > 0) {
        throw new AppError(
          400,
          "ACTIVE_SESSION_EXISTS",
          "This referral already has a session that is not done yet — finish or cancel it before booking another one"
        );
      }
      const venue =
        input.clinicSession && typeof input.clinicSession.venue === "string" && input.clinicSession.venue.trim()
          ? input.clinicSession.venue.trim()
          : "School clinic";
      sessionRow = await tx.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: sessionAt,
          venue,
          status: "scheduled",
          createdBy: ctx.userId,
        },
        include: { creator: { select: { fullName: true } } },
      });
    }
    return { updated: updatedRow, session: sessionRow };
  });
  if (session) {
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `Clinic session booked on ADM review`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
  }
  if (outcome === "endorse") {
    await writeAudit({
      userId: ctx.userId,
      actionType: "referral_status_change",
      sourceTable: "referrals",
      sourceId: referral.id,
      reason: `ADM consultation endorsed: ${recommendation.trim()}${session ? " with a clinic session booked" : ""}`,
      oldValue: { status: referral.status },
      newValue: { status: "in_progress" },
    });
  } else {
    await writeAudit({
      userId: ctx.userId,
      actionType: "referral_dismissed",
      sourceTable: "referrals",
      sourceId: referral.id,
      reason: `ADM consultation rejected: ${recommendation.trim()}`,
      oldValue: { status: referral.status },
      newValue: { status: "dismissed" },
    });
  }
  const card = await referralCard(referral);
  const recNote = truncate(recommendation.trim(), 120);
  const actor = await actorName(ctx.userId);
  // Nurse consultation endorse hands the case to the ADM coordinators
  // (coordinator toast kept); the filing adviser learns the outcome too.
  if (outcome === "endorse") {
    void fanoutToRole("adm_coordinator", {
      sourceTable: "referrals",
      action: "status",
      message: `ADM consultation endorsed — ${card.who} ready for the parent meeting${recNote ? `: ${recNote}` : ""}${session ? ` (clinic session ${formatWhen(session.scheduledAt)})` : ""}.`,
      sourceId: referral.id,
      excludeUserId: ctx.userId,
      messageFor: (r) =>
        `${actor} endorsed the ADM consultation for ${card.who} — sent to you, ${r.fullName}${recNote ? `: ${recNote}` : ""}.`,
    });
    if (referral.referredBy && referral.referredBy !== ctx.userId) {
      void fanoutNotification({
        userId: referral.referredBy,
        sourceTable: "referrals",
        action: "status",
        message: `${actor} endorsed the ADM consultation for ${card.who} — now with the coordinator.`,
        sourceId: referral.id,
      });
    }
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You endorsed an ADM consultation for ${card.who} — sent to the coordinator.`,
      sourceId: referral.id,
    });
  } else {
    if (referral.referredBy && referral.referredBy !== ctx.userId) {
      void fanoutNotification({
        userId: referral.referredBy,
        sourceTable: "referrals",
        action: "status",
        message: `Your ADM referral for ${card.who} was not endorsed — case closed${recNote ? `: ${recNote}` : ""}.`,
        sourceId: referral.id,
      });
    }
    void fanoutNotification({
      userId: ctx.userId,
      sourceTable: "referrals",
      action: "status",
      message: `You did not endorse an ADM referral for ${card.who} — case closed.`,
      sourceId: referral.id,
    });
  }
  return updated;
}

export interface NurseReferralFormInput {
  recommendation: string;
  referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown };
  clinicSession?: { scheduledAt?: unknown; venue?: unknown };
}

export async function saveNurseReferralForm(ctx: ReferralContext, referralId: string, input: NurseReferralFormInput) {
  const referral = await getNurseAdmConsultation(referralId, ctx.termId);
  if (referral.status !== "pending") {
    throw new AppError(400, "INVALID_ACTION", "Only a new case can be reviewed");
  }
  const { recommendation } = input;
  const sessionAt = parseNurseAdmSession(input.clinicSession);
  const formParts = buildAdmReferralFormNote(input.referralForm);
  const note = formParts
    ? `[ADM endorsed] ${recommendation.trim()} | ${formParts}`
    : `[ADM endorsed] ${recommendation.trim()}`;
  const withEndorsement = referral.notes ? `${referral.notes}\n${note}` : note;
  // Atomic form save: note + ready flag + optional session in one
  // transaction; the upcoming-session guard runs inside so a concurrent
  // booking cannot slip between check and write.
  const { updated, session } = await prisma.$transaction(async (tx) => {
    const active = await tx.counselingSession.count({
      where: { referralId: referral.id, status: "scheduled" },
    });
    if (active > 0) {
      throw new AppError(
        400,
        "ACTIVE_SESSION_EXISTS",
        "Finish or cancel the upcoming session (or follow-up) before confirming this referral"
      );
    }
    const updatedRow = await tx.referral.update({
      where: { id: referral.id },
      data: {
        notes: withEndorsement,
        referralFormReady: true,
      },
    });
    let sessionRow = null;
    if (sessionAt) {
      const venue =
        input.clinicSession && typeof input.clinicSession.venue === "string" && input.clinicSession.venue.trim()
          ? input.clinicSession.venue.trim()
          : "School clinic";
      sessionRow = await tx.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: "individual",
          scheduledAt: sessionAt,
          venue,
          status: "scheduled",
          createdBy: ctx.userId,
        },
        include: { creator: { select: { fullName: true } } },
      });
    }
    return { updated: updatedRow, session: sessionRow };
  });
  if (session) {
    await writeAudit({ userId: ctx.userId, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `Clinic session booked with ADM referral form`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "referral_note_added",
    sourceTable: "referrals",
    sourceId: referral.id,
    reason: "ADM referral form completed — ready to forward",
    oldValue: null,
    newValue: { referralFormReady: true },
  });
  const card = await referralCard(referral);
  // Form-save handoff (background, off the critical path): the filing
  // adviser and the acting nurse each get a bell row. Uses action
  // "form" (NOT "status") so the 60s per-user dedup can never swallow
  // the seconds-later forward handoff for any recipient.
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "form",
      message: `The clinic completed the referral form for ${card.who} — ready to forward.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "form_self",
    message: `You completed the referral form for ${card.who} — ready to forward.`,
    sourceId: referral.id,
  });
  return updated;
}

// Explicit forward: moves a form-ready ADM consultation case to the ADM
// coordinator (status → in_progress). Requires the completed referral form —
// without it the case stays on the nurse's desk no matter what.
export async function forwardNurseAdm(ctx: ReferralContext, referralId: string) {
  const referral = await getNurseAdmConsultation(referralId, ctx.termId);
  if (referral.status !== "pending") {
    throw new AppError(400, "INVALID_ACTION", "Only a new case can be forwarded");
  }
  if (!referral.referralFormReady) {
    throw new AppError(
      400,
      "FORM_NOT_READY",
      "Complete the referral form before forwarding this case"
    );
  }
  // Forwarding is the second half of confirming — same upcoming-session
  // block as the form save.
  await ensureNoActiveSession(referral.id);
  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "in_progress" },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "referral_status_change",
    sourceTable: "referrals",
    sourceId: referral.id,
    reason: "ADM referral forwarded to the coordinator",
    oldValue: { status: referral.status },
    newValue: { status: "in_progress" },
  });
  const card = await referralCard(referral);
  // Explicit forward hands the case to the ADM coordinators (coordinator
  // toast kept); the filing adviser learns the case moved too.
  void fanoutToRole("adm_coordinator", {
    sourceTable: "referrals",
    action: "status",
    message: `ADM consultation endorsed — ${card.who} ready for the parent meeting.`,
    sourceId: referral.id,
    excludeUserId: ctx.userId,
  });
  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "referrals",
      action: "status",
      message: `Your ADM referral for ${card.who} was forwarded to the coordinator.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "referrals",
    action: "status",
    message: `You forwarded an ADM referral for ${card.who} to the coordinator.`,
    sourceId: referral.id,
  });
  return updated;
}
