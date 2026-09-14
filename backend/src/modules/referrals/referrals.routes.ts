import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";

const router = Router();

const statusSchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "escalated", "info_requested", "dismissed", "follow_up"]),
  resolutionSummary: z.string().trim().min(1).max(2000).optional(),
});

router.post(
  "/:id/status",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", statusSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      // ADM consultation-stage cases move through the review endpoint, not
      // raw status edits — otherwise the pipeline (consult → parent meeting
      // → certification) is bypassed silently.
      if (req.user!.role === "nurse" && referral.referredToRole === "adm_coordinator") {
        const profileCount = await prisma.admLearnerProfile.count({
          where: { referralId: referral.id },
        });
        if (
          referral.consultReviewer === "nurse" &&
          profileCount === 0 &&
          referral.status === "pending"
        ) {
          throw new AppError(
            400,
            "USE_REVIEW_ENDPOINT",
            "ADM cases move through consultation review — use the ADM review action"
          );
        }
      }
      if (
        req.user!.role === "guidance_counselor" &&
        referral.referredToRole !== "guidance_counselor"
      ) {
        throw new AppError(403, "FORBIDDEN", "Not routed to guidance");
      }
      if (referral.status === req.body.status) return res.json(referral);
      // Strict close-out for guidance cases: finishing at least one
      // counseling session plus a closing summary is mandatory. Other
      // roles keep their own (ungated) workflows.
      const resolvingGuidanceCase =
        req.body.status === "resolved" &&
        referral.referredToRole === "guidance_counselor" &&
        referral.status !== "resolved";
      if (resolvingGuidanceCase) {
        const doneCount = await prisma.counselingSession.count({
          where: { referralId: referral.id, status: "completed" },
        });
        if (doneCount === 0) {
          throw new AppError(400, "RESOLVE_BLOCKED", "Finish at least one counseling session before resolving this case");
        }
        if (!req.body.resolutionSummary) {
          throw new AppError(400, "RESOLVE_BLOCKED", "A closing summary is required to resolve this case");
        }
      }
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: req.body.status,
          ...(resolvingGuidanceCase
            ? {
                resolutionSummary: req.body.resolutionSummary,
                resolvedAt: new Date(),
              }
            : {}),
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Status → ${req.body.status}`, oldValue: { status: referral.status }, newValue: { status: req.body.status } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const escalateSchema = z.object({
  escalationReason: z.string().min(1).max(500),
  escalatedTo: z.enum(["principal", "nurse", "adm_coordinator"]),
});

router.post(
  "/:id/escalate",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", escalateSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot escalate a resolved referral");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "escalated",
          escalationReason: req.body.escalationReason,
          escalatedTo: req.body.escalatedTo,
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_escalated", sourceTable: "referrals", sourceId: referral.id, reason: req.body.escalationReason, oldValue: { status: referral.status }, newValue: { status: "escalated", escalatedTo: req.body.escalatedTo } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const reassignSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
});

router.post(
  "/:id/reassign",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", reassignSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot reassign a resolved referral");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { referredToRole: req.body.referredToRole },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_reassigned", sourceTable: "referrals", sourceId: referral.id, reason: `Reassigned to ${req.body.referredToRole}`, oldValue: { referredToRole: referral.referredToRole }, newValue: { referredToRole: req.body.referredToRole } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const noteSchema = z.object({
  notes: z.string().min(1).max(2000),
});

router.post(
  "/:id/note",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", noteSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { notes: req.body.notes },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_note_added", sourceTable: "referrals", sourceId: referral.id, reason: "Internal note added", oldValue: null, newValue: { notes: req.body.notes } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const followUpSchema = z.object({
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post(
  "/:id/follow-up",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", followUpSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot flag a resolved referral for follow-up");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "follow_up", followUpDate: new Date(req.body.followUpDate) },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_follow_up", sourceTable: "referrals", sourceId: referral.id, reason: `Follow-up on ${req.body.followUpDate}`, oldValue: { status: referral.status }, newValue: { status: "follow_up", followUpDate: req.body.followUpDate } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const dismissSchema = z.object({
  reason: z.string().min(1).max(500),
});

router.post(
  "/:id/dismiss",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", dismissSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Referral already resolved");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "dismissed", notes: req.body.reason },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const specialistSchema = z.object({
  referredToRole: z.enum(["nurse", "adm_coordinator", "principal"]),
  reason: z.string().min(1).max(500),
});

router.post(
  "/:id/specialist",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", specialistSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot refer a resolved referral");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { referredToRole: req.body.referredToRole as any, reason: req.body.reason, status: "pending" },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_referred_specialist", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { referredToRole: referral.referredToRole, status: referral.status }, newValue: { referredToRole: req.body.referredToRole, status: "pending" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const admSchema = z.object({
  reason: z.string().min(1).max(500),
});

router.post(
  "/:id/adm",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", admSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === "resolved") throw new AppError(400, "INVALID_ACTION", "Cannot initiate ADM on a resolved referral");
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { referredToRole: "adm_coordinator", reason: req.body.reason, status: "pending" },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_adm_initiated", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { referredToRole: referral.referredToRole, status: referral.status }, newValue: { referredToRole: "adm_coordinator", status: "pending" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const SESSION_TYPES = ["individual", "parent_conference", "group", "home_visit"] as const;
type SessionType = (typeof SESSION_TYPES)[number];

function isSessionType(value: unknown): value is SessionType {
  return typeof value === "string" && (SESSION_TYPES as readonly string[]).includes(value);
}

async function getGuidanceReferral(id: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  if (referral.referredToRole !== "guidance_counselor") {
    throw new AppError(403, "FORBIDDEN", "Not routed to guidance");
  }
  return referral;
}

// Clinic cases on the nurse's own desk (direct referrals + escalations to
// the nurse). Session management below accepts these exactly like guidance
// cases, so the nurse referrals page runs the same accept → sessions →
// close workflow.
async function getNurseClinicReferral(id: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
  const onNurseDesk =
    referral.referredToRole === "nurse" ||
    (referral.status === "escalated" && referral.escalatedTo === "nurse");
  if (!onNurseDesk) {
    throw new AppError(403, "FORBIDDEN", "Not routed to the clinic");
  }
  return referral;
}

// Role-aware referral getter for the shared session endpoints.
async function getSessionReferral(id: string, role: string) {
  if (role === "nurse") return getNurseClinicReferral(id);
  return getGuidanceReferral(id);
}

function parseScheduledAt(value: unknown): Date {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
  }
  return date;
}

function formatSession(row: {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  creator?: { fullName: string } | null;
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
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdBy: row.creator?.fullName ?? "",
  };
}

// Accept a case WITH intake: priority triage, first impressions, and an
// optional first counseling session booked on the spot.
const acceptSchema = z.object({
  priority: z.enum(["low", "normal", "high"]),
  intakeNotes: z.string().trim().max(2000).optional(),
  firstSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

router.post(
  "/:id/accept",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", acceptSchema),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
      if (referral.status !== "pending") {
        throw new AppError(400, "INVALID_ACTION", "Only a new case can be accepted");
      }
      if (req.body.firstSession && !isSessionType(req.body.firstSession.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown session type");
      }
      const firstAt = req.body.firstSession
        ? parseScheduledAt(req.body.firstSession.scheduledAt)
        : null;
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "in_progress",
          priority: req.body.priority,
          intakeNotes: req.body.intakeNotes?.trim() ? req.body.intakeNotes.trim() : null,
          acceptedAt: new Date(),
        },
      });
      if (req.body.firstSession && firstAt) {
        const created = await prisma.counselingSession.create({
          data: {
            referralId: referral.id,
            sessionType: req.body.firstSession.sessionType,
            scheduledAt: firstAt,
            venue: req.body.firstSession.venue?.trim() || null,
            status: "scheduled",
            createdBy: req.user!.id,
          },
        });
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: `First session booked on accept`, oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
      }
      await writeAudit({ userId: req.user!.id, actionType: "referral_accepted", sourceTable: "referrals", sourceId: referral.id, reason: `Accepted with ${req.body.priority} priority`, oldValue: { status: referral.status }, newValue: { status: "in_progress", priority: req.body.priority } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// Nurse intake: accept a case on the clinic's desk WITH first impressions
// and an optional first clinic session booked on the spot — one atomic
// call so a case is never half-accepted. Mirrors the guidance accept flow
// but scoped to the nurse's own queue (direct, escalated-to-nurse, or ADM
// consultation picked for the nurse).
const nurseAcceptSchema = z.object({
  intakeNotes: z.string().trim().max(2000).optional(),
  clinicSession: z
    .object({
      scheduledAt: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

router.post(
  "/:id/nurse-accept",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseAcceptSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
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
      if (req.body.clinicSession) {
        sessionAt = parseScheduledAt(req.body.clinicSession.scheduledAt);
        if (sessionAt.getTime() <= Date.now()) {
          throw new AppError(400, "INVALID_ACTION", "Clinic session must be set in the future");
        }
      }
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "in_progress",
          intakeNotes: req.body.intakeNotes?.trim() ? req.body.intakeNotes.trim() : null,
          acceptedAt: new Date(),
        },
      });
      let session = null;
      if (sessionAt) {
        session = await prisma.counselingSession.create({
          data: {
            referralId: referral.id,
            sessionType: "individual",
            scheduledAt: sessionAt,
            venue: req.body.clinicSession?.venue?.trim() || "School clinic",
            status: "scheduled",
            createdBy: req.user!.id,
          },
          include: { creator: { select: { fullName: true } } },
        });
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `First clinic session booked on accept`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
      }
      await writeAudit({ userId: req.user!.id, actionType: "referral_accepted", sourceTable: "referrals", sourceId: referral.id, reason: `Accepted by the clinic${session ? " with a clinic session booked" : ""}`, oldValue: { status: referral.status }, newValue: { status: "in_progress" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json({ referral: updated, clinicSession: session ? formatSession(session) : null });
    } catch (e) { next(e); }
  }
);

// Nurse consultation review on an ADM-purpose referral sitting at the
// consultation stage with no learner profile yet. Mirrors the guidance
// consultation review, but only the nurse may decide cases picked for the
// nurse (consultReviewer === "nurse"):
//   - endorse: consultation done, case moves to in_progress for the ADM
//     coordinator's parent meeting (the "create referral forward").
//   - reject: the filing doesn't warrant ADM, case closes as dismissed.
// Shared guards for every nurse ADM-consultation action: the case must be
// an ADM-track referral at the consultation stage picked for the nurse.
// Receiver enforcement lives here so a case picked for guidance or LRPC
// cannot be decided from the clinic queue, even if its id is known.
async function getNurseAdmConsultation(id: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    (await prisma.admLearnerProfile.count({ where: { referralId: referral.id } })) > 0
  ) {
    throw new AppError(
      404,
      "NOT_ADM_CONSULTATION",
      "Only an ADM referral awaiting consultation review can be reviewed here"
    );
  }
  if (referral.consultReviewer !== "nurse") {
    throw new AppError(
      403,
      "NOT_YOUR_QUEUE",
      "This case was routed to another consultation reviewer"
    );
  }
  return referral;
}

// Flatten the referral form fill-up into one notes block so the coordinator
// receives the nurse's concerns, details, actions taken, and follow-up plan
// with the case. Returns null when the form carries no answers.
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
  return parts.length > 0 ? `[ADM referral] ${parts.join(" | ")}` : null;
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

const clinicSessionSchema = z
  .object({
    scheduledAt: z.string().min(1),
    venue: z.string().trim().max(200).optional(),
  })
  .optional();

const referralFormSchema = z
  .object({
    concerns: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    detailsOfConcern: z.string().trim().max(2000).optional(),
    nurseActions: z.string().trim().max(2000).optional(),
    followUp: z.string().trim().max(2000).optional(),
  })
  .optional();

const nurseAdmReviewSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  outcome: z.enum(["endorse", "reject"]),
  clinicSession: clinicSessionSchema,
  // Kept for backward compatibility — new flows save the form first via
  // nurse-referral-form and forward via nurse-adm-forward.
  referralForm: referralFormSchema,
});

router.post(
  "/:id/nurse-adm-review",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseAdmReviewSchema),
  async (req, res, next) => {
    try {
      const referral = await getNurseAdmConsultation(String(req.params.id));
      if (referral.status !== "pending") {
        throw new AppError(400, "INVALID_ACTION", "Only a new case can be reviewed");
      }
      const { recommendation, outcome } = req.body as {
        recommendation: string;
        outcome: "endorse" | "reject";
      };
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
      const clinicInput = (req.body as { clinicSession?: { scheduledAt?: unknown; venue?: unknown } }).clinicSession;
      const sessionAt = clinicInput && outcome === "endorse" ? parseNurseAdmSession(clinicInput) : null;
      const note = `[ADM consult] ${recommendation.trim()}`;
      const formInput = (req.body as { referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown } }).referralForm;
      const formNote = formInput && outcome === "endorse" ? buildAdmReferralFormNote(formInput) : null;
      const notesWithReview = referral.notes ? `${referral.notes}\n${note}` : note;
      const notesWithForm = formNote ? `${notesWithReview}\n${formNote}` : notesWithReview;
      const updated = await prisma.referral.update({
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
      let session = null;
      if (sessionAt) {
        session = await createNurseAdmSession(referral.id, req.user!.id, sessionAt, clinicInput, `Clinic session booked on ADM review`);
      }
      if (outcome === "endorse") {
        await writeAudit({
          userId: req.user!.id,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `ADM consultation endorsed: ${recommendation.trim()}${session ? " with a clinic session booked" : ""}`,
          oldValue: { status: referral.status },
          newValue: { status: "in_progress" },
        });
      } else {
        await writeAudit({
          userId: req.user!.id,
          actionType: "referral_dismissed",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `ADM consultation rejected: ${recommendation.trim()}`,
          oldValue: { status: referral.status },
          newValue: { status: "dismissed" },
        });
      }
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// Save the nurse's referral form (GCForm-03 fill-up) on an ADM consultation
// case. The case STAYS pending — nothing moves to the ADM coordinator here.
// Confirming the form sets referralFormReady, which unlocks the explicit
// forward action (nurse-adm-forward, surfaced as Endorse & forward on the
// alerts page). Re-saving while pending refreshes the stored answers.
const nurseReferralFormSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  referralForm: referralFormSchema,
  clinicSession: clinicSessionSchema,
});

router.post(
  "/:id/nurse-referral-form",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseReferralFormSchema),
  async (req, res, next) => {
    try {
      const referral = await getNurseAdmConsultation(String(req.params.id));
      if (referral.status !== "pending") {
        throw new AppError(400, "INVALID_ACTION", "Only a new case can be reviewed");
      }
      const { recommendation } = req.body as { recommendation: string };
      const clinicInput = (req.body as { clinicSession?: { scheduledAt?: unknown; venue?: unknown } }).clinicSession;
      const sessionAt = parseNurseAdmSession(clinicInput);
      const formInput = (req.body as { referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown } }).referralForm;
      const formNote = buildAdmReferralFormNote(formInput);
      const note = `[ADM consult] ${recommendation.trim()}`;
      const withReview = referral.notes ? `${referral.notes}\n${note}` : note;
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          intakeNotes: recommendation.trim(),
          notes: formNote ? `${withReview}\n${formNote}` : withReview,
          referralFormReady: true,
        },
      });
      if (sessionAt) {
        await createNurseAdmSession(referral.id, req.user!.id, sessionAt, clinicInput, `Clinic session booked with ADM referral form`);
      }
      await writeAudit({
        userId: req.user!.id,
        actionType: "referral_note_added",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "ADM referral form completed — ready to forward",
        oldValue: null,
        newValue: { referralFormReady: true },
      });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// Explicit forward: moves a form-ready ADM consultation case to the ADM
// coordinator (status → in_progress). Requires the completed referral form —
// without it the case stays on the nurse's desk no matter what.
router.post(
  "/:id/nurse-adm-forward",
  requireAuth,
  requireRole("nurse"),
  async (req, res, next) => {
    try {
      const referral = await getNurseAdmConsultation(String(req.params.id));
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
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "in_progress" },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "referral_status_change",
        sourceTable: "referrals",
        sourceId: referral.id,
        reason: "ADM referral forwarded to the coordinator",
        oldValue: { status: referral.status },
        newValue: { status: "in_progress" },
      });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const sessionSchema = z.object({
  scheduledAt: z.string().min(1),
  sessionType: z.string().min(1),
  venue: z.string().trim().max(200).optional(),
});

function ensureOpen(referral: { status: string }) {
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot change sessions on a closed case");
  }
}

router.get(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor", "principal", "nurse"),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      const sessions = await prisma.counselingSession.findMany({
        where: { referralId: referral.id },
        orderBy: { scheduledAt: "asc" },
        include: { creator: { select: { fullName: true } } },
      });
      res.json(sessions.map(formatSession));
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", sessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      ensureOpen(referral);
      if (!isSessionType(req.body.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown session type");
      }
      const created = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: req.body.sessionType,
          scheduledAt: parseScheduledAt(req.body.scheduledAt),
          venue: req.body.venue?.trim() || null,
          status: "scheduled",
          createdBy: req.user!.id,
        },
        include: { creator: { select: { fullName: true } } },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.status(201).json(formatSession(created));
    } catch (e) { next(e); }
  }
);

async function getSession(referralId: string, sessionId: string) {
  const session = await prisma.counselingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.referralId !== referralId) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return session;
}

const completeSessionSchema = z.object({
  sessionNotes: z.string().trim().min(1).max(5000),
  outcome: z.string().trim().max(2000).optional(),
  followUpSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

router.post(
  "/:id/sessions/:sessionId/complete",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", completeSessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      ensureOpen(referral);
      const session = await getSession(referral.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be marked done");
      }
      if (req.body.followUpSession && !isSessionType(req.body.followUpSession.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
      }
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: {
          status: "completed",
          sessionNotes: req.body.sessionNotes.trim(),
          outcome: req.body.outcome?.trim() || null,
          completedAt: new Date(),
        },
        include: { creator: { select: { fullName: true } } },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_completed", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session completed", oldValue: { status: session.status }, newValue: { status: "completed" } });
      if (req.body.followUpSession) {
        const next = await prisma.counselingSession.create({
          data: {
            referralId: referral.id,
            sessionType: req.body.followUpSession.sessionType,
            scheduledAt: parseScheduledAt(req.body.followUpSession.scheduledAt),
            venue: req.body.followUpSession.venue?.trim() || null,
            status: "scheduled",
            createdBy: req.user!.id,
          },
        });
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: next.id, reason: "Follow-up session booked", oldValue: null, newValue: { sessionType: next.sessionType, scheduledAt: next.scheduledAt } });
      }
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

const rescheduleSchema = z.object({
  scheduledAt: z.string().min(1),
});

router.post(
  "/:id/sessions/:sessionId/reschedule",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", rescheduleSchema),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      ensureOpen(referral);
      const session = await getSession(referral.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be moved");
      }
      const nextDate = parseScheduledAt(req.body.scheduledAt);
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: { scheduledAt: nextDate },
        include: { creator: { select: { fullName: true } } },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_rescheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Counseling session moved", oldValue: { scheduledAt: session.scheduledAt }, newValue: { scheduledAt: nextDate } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

const cancelSessionSchema = z.object({
  cancelReason: z.string().trim().max(500).optional(),
});
router.post(
  "/:id/sessions/:sessionId/cancel",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", cancelSessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      ensureOpen(referral);
      const session = await getSession(referral.id, String(req.params.sessionId));
      if (session.status !== "scheduled") {
        throw new AppError(400, "INVALID_ACTION", "Only an upcoming session can be cancelled");
      }
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: {
          status: "cancelled",
          cancelReason: req.body.cancelReason?.trim() || null,
        },
        include: { creator: { select: { fullName: true } } },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: session.id, reason: req.body.cancelReason?.trim() || "Counseling session cancelled", oldValue: { status: session.status }, newValue: { status: "cancelled" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      // Receiver scoping: never leak another role's referrals + full
      // anecdotal write-ups to this caller. The nurse desk only receives
      // clinic-routed cases, escalations to the nurse, and ADM-track cases
      // where the teacher picked the nurse as consultation reviewer —
      // guidance-picked / LRPC-picked ADM cases stay invisible here (this is
      // what keeps ADM anecdotal out of /nurse/alerts unless it is really
      // the nurse's consultation to review).
      const role = req.user!.role;
      // Typed as `any` — string literals here are Prisma ReferralTarget /
      // ReferralStatus enums; a strict WhereInput annotation would reject
      // the ternary union without adding safety.
      const where: any =
        role === "nurse"
          ? {
              OR: [
                { referredToRole: "nurse" },
                { status: "escalated", escalatedTo: "nurse" },
                { referredToRole: "adm_coordinator", consultReviewer: "nurse" },
              ],
            }
          : role === "guidance_counselor"
            ? { referredToRole: "guidance_counselor" }
            : role === "adm_coordinator"
              ? {
                  OR: [
                    { referredToRole: "adm_coordinator" },
                    { status: "escalated", escalatedTo: "adm_coordinator" },
                  ],
                }
              : undefined;
      const referrals = await prisma.referral.findMany({
        where,
        include: {
          anecdotalRecord: true,
          student: { include: { section: { select: { name: true } } } },
          roster: { include: { section: { select: { name: true } } } },
          // Clinic/counseling sessions per case (oldest first) so the nurse
          // referrals page renders the same counseling-plan workflow as the
          // guidance referrals page without extra round-trips.
          counselingSessions: {
            orderBy: { scheduledAt: "asc" },
            select: {
              id: true,
              sessionType: true,
              scheduledAt: true,
              venue: true,
              status: true,
              sessionNotes: true,
              outcome: true,
              cancelReason: true,
              completedAt: true,
            },
          },
        },
        orderBy: { id: "asc" },
      });
      // Referral time = earliest audit entry for the referral (creation
      // always writes one). Legacy rows without an audit trail fall back
      // to the observation date so "waiting" never goes blank.
      const ids = referrals.map((r) => r.id);
      const logs = ids.length
        ? await prisma.auditLog.findMany({
            where: { sourceTable: "referrals", sourceId: { in: ids } },
            select: { sourceId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          })
        : [];
      const referredAtById = new Map<string, string>();
      for (const log of logs) {
        if (!referredAtById.has(log.sourceId)) {
          referredAtById.set(log.sourceId, log.createdAt.toISOString());
        }
      }
      res.json(
        referrals.map((r) => ({
          ...r,
          referredAt:
            referredAtById.get(r.id) ??
            r.anecdotalRecord?.observationDatetime?.toISOString() ??
            null,
        })),
      );
    } catch (e) { next(e); }
  }
);

// Teacher-scoped referrals: returns referrals where the teacher is the referrer
// (referredBy = me), narrowed to their advisory sections' students. Adviser-only
// (404 if the teacher has no advisory section). Subject teachers may also read
// referrals they originated (PLANS/teacher-referrals.md §4.4).
router.get(
  "/mine",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await prisma.section.findMany({
        where: { adviserId: teacherId },
        select: { id: true, name: true, gradeLevel: true },
      });
      if (sections.length === 0 && req.user!.role === "adviser") {
        throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
      }
      const sectionIds = sections.map((s) => s.id);
      const referralWhere = {
        referredBy: teacherId,
        ...(sectionIds.length > 0
          ? {
              OR: [
                { student: { sectionId: { in: sectionIds } } },
                { roster: { sectionId: { in: sectionIds } } },
              ],
            }
          : {}),
      };
      const referrals = await prisma.referral.findMany({
        where: referralWhere,
        include: {
          student: {
            select: {
              lrn: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          roster: {
            select: {
              lrn: true,
              fullName: true,
              section: { select: { name: true } },
            },
          },
          anecdotalRecord: {
            select: {
              id: true,
              observationDatetime: true,
              category: true,
              confidentialityLevel: true,
              descriptionOfIncident: true,
              notesRecommendationsActions: true,
            },
          },
          // Real follow-through evidence (status-only for teachers — no
          // clinical text leaves this endpoint).
          homeVisitations: { select: { id: true } },
          admProfiles: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              stage: true,
              eligibilityStatus: true,
              approvedBy: true,
              approvedAt: true,
              createdAt: true,
              parentMeetings: {
                orderBy: { meetingDatetime: "desc" },
                take: 5,
                select: { attended: true, meetingDatetime: true },
              },
            },
          },
        },
        orderBy: { id: "desc" },
      });

      const referralIds = referrals.map((r) => r.id);
      const auditEntries = await prisma.auditLog.findMany({
        where: {
          sourceTable: "referrals",
          sourceId: { in: referralIds },
        },
        orderBy: { createdAt: "asc" },
      });
      const logsByReferral = new Map<string, { createdAt: Date; reason: string | null }[]>();
      for (const log of auditEntries) {
        const list = logsByReferral.get(log.sourceId) ?? [];
        list.push({ createdAt: log.createdAt, reason: (log as { reason?: string | null }).reason ?? null });
        logsByReferral.set(log.sourceId, list);
      }

      const admLabelByStage = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

      const formatted = referrals.map((r) => {
        const isAdm = r.referredToRole === "adm_coordinator";
        const profile = r.admProfiles[0] ?? null;
        const meetings = profile?.parentMeetings ?? [];
        const hasParentMeeting = meetings.length > 0;
        const meetingAttended = meetings.length > 0 ? meetings.some((m) => m.attended) : null;
        const hasHomeVisit = r.homeVisitations.length > 0;
        // Canonical ADM stage enum (anecdotal → … → completion). A fresh ADM
        // referral with no profile yet sits at consultation.
        const admStage = isAdm ? (profile?.stage ?? "consultation") : null;

        const logs = logsByReferral.get(r.id) ?? [];
        const referredAt = logs[0]?.createdAt.toISOString() ?? new Date().toISOString();
        const timeline = logs.map((l) => ({
          label: l.reason ?? "Referral update",
          date: l.createdAt.toISOString().slice(0, 10),
        }));
        if (timeline.length === 0) {
          timeline.push({
            label: `Referred to ${r.referredToRole}`,
            date: referredAt.slice(0, 10),
          });
        }
        if (profile) {
          timeline.push({
            label: `ADM stage: ${admLabelByStage.get(profile.stage) ?? profile.stage}`,
            date: profile.createdAt.toISOString().slice(0, 10),
          });
        }
        if (profile?.approvedBy && profile.approvedAt) {
          timeline.push({
            label: "Principal approval signed",
            date: profile.approvedAt.toISOString().slice(0, 10),
          });
        }

        return {
          id: r.id,
          studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
          lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
          section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
          targetRole: r.referredToRole,
          referredBy: r.referredBy,
          reason: r.reason,
          status: r.status,
          referredAt,
          resolvedAt: r.status === "resolved" ? (logs[logs.length - 1]?.createdAt.toISOString() ?? new Date().toISOString()) : null,
          anecdotalId: r.anecdotalRecordId,
          observationDate: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
          anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
          category: r.anecdotalRecord.category,
          track: isAdm ? "adm" : "general",
          // Truthful routing: the teacher-picked consultation reviewer, or
          // the coordinator for legacy rows without a stored pick.
          admReceiver: isAdm ? (r.consultReviewer ?? "adm_coordinator") : null,
          hasParentMeeting,
          meetingAttended,
          hasHomeVisit,
          admStage,
          admStageLabel: admStage ? (admLabelByStage.get(admStage) ?? admStage) : null,
          admEligibility: profile?.eligibilityStatus ?? null,
          admApproved: !!profile?.approvedBy,
          admApprovedAt: profile?.approvedAt ? profile.approvedAt.toISOString() : null,
          timeline,
          notes: r.notes,
          escalationReason: r.escalationReason,
          followUpDate: r.followUpDate,
          escalatedTo: r.escalatedTo,
        };
      });

      res.json(formatted);
    } catch (e) { next(e); }
  }
);

export default router;