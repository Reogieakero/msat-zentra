import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";

// Clinic documentation uploads: photos filed on a session (wound, slip,
// lab result…). Images only, 5 MB each, max 5 per request — filing is
// optional before closing a clinic case, so uploads never gate resolve.
const clinicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP images are allowed for clinic documentation."));
    }
  },
});

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
      // counseling session plus a closing summary is mandatory.
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
      // Clinic close-out (nurse desk: direct + escalated-to-nurse cases):
      // review → accept → ≥1 completed clinic session → done. Documentation
      // (images / notes) stays optional and never blocks resolve — only the
      // completed session does. Resolving straight from pending/escalated
      // (skipping Start handling) is rejected so the review step can't be
      // bypassed silently.
      const onNurseClinicDesk =
        referral.referredToRole === "nurse" ||
        (referral.status === "escalated" && referral.escalatedTo === "nurse");
      const resolvingClinicCase =
        req.body.status === "resolved" &&
        onNurseClinicDesk &&
        referral.status !== "resolved";
      if (resolvingClinicCase) {
        if (
          referral.status === "pending" ||
          (referral.status === "escalated" && referral.escalatedTo === "nurse")
        ) {
          throw new AppError(
            400,
            "RESOLVE_BLOCKED",
            "Start handling this case first — review the details and accept it before marking it done"
          );
        }
        const doneCount = await prisma.counselingSession.count({
          where: { referralId: referral.id, status: "completed" },
        });
        if (doneCount === 0) {
          throw new AppError(
            400,
            "RESOLVE_BLOCKED",
            "Finish at least one clinic session before marking this case done"
          );
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
            : resolvingClinicCase
              ? {
                  ...(req.body.resolutionSummary
                    ? { resolutionSummary: req.body.resolutionSummary }
                    : {}),
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
  if (role === "nurse") {
    // Clinic desk first; ADM consultations picked for the nurse may also
    // carry standalone clinic sessions (booked from the review dialog
    // without deciding the case), so they fall through to the ADM getter.
    try {
      return await getNurseClinicReferral(id);
    } catch {
      return await getNurseAdmSessionsReferral(id);
    }
  }
  if (role === "guidance_counselor") {
    // Guidance desk first; ADM consultations picked for (or left with)
    // guidance may also carry sessions booked from the ADM review, so
    // they fall through to the ADM getter the same way the nurse desk does.
    try {
      return await getGuidanceReferral(id);
    } catch {
      return await getGuidanceAdmSessionsReferral(id);
    }
  }
  return getGuidanceReferral(id);
}

// Session scope for nurse ADM consultations: the case must be ADM-track and
// picked for the nurse. No consultation-stage or status gate here —
// standalone sessions can be booked while pending (pre-confirm) and stay
// visible afterwards; closing the case itself still blocks changes via
// ensureOpen at each endpoint.
async function getNurseAdmSessionsReferral(id: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    referral.consultReviewer !== "nurse"
  ) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return referral;
}

// Session scope for guidance ADM consultations: the case must be ADM-track
// and picked for (or left with) guidance — same receiver rule as the
// consultation review endpoint. Standalone sessions can be booked while
// pending (pre-decision) and stay visible afterwards; closing the case
// itself still blocks changes via ensureOpen at each endpoint.
async function getGuidanceAdmSessionsReferral(id: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (
    !referral ||
    referral.referredToRole !== "adm_coordinator" ||
    (referral.consultReviewer !== null &&
      referral.consultReviewer !== undefined &&
      referral.consultReviewer !== "guidance_counselor")
  ) {
    throw new AppError(404, "NOT_FOUND", "Session not found");
  }
  return referral;
}

function parseScheduledAt(value: unknown): Date {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
  }
  return date;
}

function formatAttachment(row: {
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

function formatSession(row: {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt?: Date | null;
  completedAt: Date | null;
  creator?: { fullName: string } | null;
  attachments?: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: Date;
  }>;
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
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdBy: row.creator?.fullName ?? "",
    attachments: (row.attachments ?? []).map(formatAttachment),
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
        // Accept carries the first session — still blocked when an active
        // session already exists on this referral.
        await ensureNoActiveSession(referral.id);
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
      const formParts = formInput && outcome === "endorse" ? buildAdmReferralFormNote(formInput) : null;
      const formNote = formParts ? `[ADM referral] ${formParts}` : null;
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
// case. Confirming the form writes one endorse-style internal note and sets
// referralFormReady — the UI forwards (endorses) to the ADM coordinator
// right away, so the note reads as the endorsement. The nurse's
// recommendation is NOT copied to intakeNotes, so ADM cards never show a
// "First impressions" line. Re-saving while pending refreshes the answers.
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
      // Confirming is blocked while a session is still upcoming — finish
      // or cancel it first (covers booked sessions and booked follow-ups).
      await ensureNoActiveSession(referral.id);
      const { recommendation } = req.body as { recommendation: string };
      const clinicInput = (req.body as { clinicSession?: { scheduledAt?: unknown; venue?: unknown } }).clinicSession;
      const sessionAt = parseNurseAdmSession(clinicInput);
      const formInput = (req.body as { referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown } }).referralForm;
      const formParts = buildAdmReferralFormNote(formInput);
      const note = formParts
        ? `[ADM endorsed] ${recommendation.trim()} | ${formParts}`
        : `[ADM endorsed] ${recommendation.trim()}`;
      const withEndorsement = referral.notes ? `${referral.notes}\n${note}` : note;
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          notes: withEndorsement,
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
      // Forwarding is the second half of confirming — same upcoming-session
      // block as the form save.
      await ensureNoActiveSession(referral.id);
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

// One active session per referral: booking is blocked while the referral
// still has a session that is not done yet (status === "scheduled").
// Pass exceptSessionId when the caller is completing that session and
// booking its follow-up in the same request.
async function ensureNoActiveSession(referralId: string, exceptSessionId?: string) {
  const active = await prisma.counselingSession.count({
    where: {
      referralId,
      status: "scheduled",
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
  });
  if (active > 0) {
    throw new AppError(
      400,
      "ACTIVE_SESSION_EXISTS",
      "This referral already has a session that is not done yet — finish or cancel it before booking another one"
    );
  }
}

// Clinic/counseling sessions unlock only once their scheduled time arrives:
// a still-upcoming session can be moved or cancelled, but it cannot be
// marked done and cannot take documentation yet.
function ensureSessionStarted(session: { scheduledAt: Date }) {
  if (session.scheduledAt.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This session hasn't started yet — you can mark it done and file documentation once the scheduled time arrives"
    );
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
        include: {
          creator: { select: { fullName: true } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
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
      // One active session per referral — finish or cancel the existing
      // scheduled session before booking another one.
      await ensureNoActiveSession(referral.id);
      const created = await prisma.counselingSession.create({
        data: {
          referralId: referral.id,
          sessionType: req.body.sessionType,
          scheduledAt: parseScheduledAt(req.body.scheduledAt),
          venue: req.body.venue?.trim() || null,
          status: "scheduled",
          createdBy: req.user!.id,
        },
        include: {
          creator: { select: { fullName: true } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
      // Booking is handling: a still-pending referral leaves "Needs review"
      // the moment its first session is booked (mirrors nurse-accept, which
      // flips pending → in_progress when a session goes with the accept).
      if (referral.status === "pending") {
        await prisma.referral.update({
          where: { id: referral.id },
          data: { status: "in_progress" },
        });
        await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: "Session booked — case now in progress", oldValue: { status: "pending" }, newValue: { status: "in_progress" } });
      }
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
      // A still-upcoming session cannot be marked done — it unlocks once
      // the scheduled time arrives.
      ensureSessionStarted(session);
      if (req.body.followUpSession && !isSessionType(req.body.followUpSession.sessionType)) {
        throw new AppError(400, "INVALID_ACTION", "Unknown follow-up session type");
      }
      // The follow-up replaces this session, so other active sessions
      // (excluding this one) still block booking it.
      if (req.body.followUpSession) {
        await ensureNoActiveSession(referral.id, session.id);
      }
      const updated = await prisma.counselingSession.update({
        where: { id: session.id },
        data: {
          status: "completed",
          sessionNotes: req.body.sessionNotes.trim(),
          outcome: req.body.outcome?.trim() || null,
          completedAt: new Date(),
        },
        include: {
          creator: { select: { fullName: true } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
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
        // Marking done WITH a follow-up counts the referral as follow-up —
        // sidebar menus, counts, and due lists key off this. Scoped to the
        // clinic/counseling desks: ADM-track referrals keep their pipeline
        // status (pending → endorsed) so consultation review still works.
        if (referral.referredToRole === "nurse" || referral.referredToRole === "guidance_counselor") {
          await prisma.referral.update({
            where: { id: referral.id },
            data: { status: "follow_up", followUpDate: next.scheduledAt },
          });
          await writeAudit({ userId: req.user!.id, actionType: "referral_follow_up", sourceTable: "referrals", sourceId: referral.id, reason: `Follow-up on ${next.scheduledAt.toISOString().slice(0, 10)}`, oldValue: { status: referral.status }, newValue: { status: "follow_up", followUpDate: next.scheduledAt.toISOString().slice(0, 10) } });
        }
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
        include: {
          creator: { select: { fullName: true } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
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
        include: {
          creator: { select: { fullName: true } },
          attachments: { orderBy: { uploadedAt: "asc" } },
        },
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: session.id, reason: req.body.cancelReason?.trim() || "Counseling session cancelled", oldValue: { status: session.status }, newValue: { status: "cancelled" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json(formatSession(updated));
    } catch (e) { next(e); }
  }
);

// Permanently remove a cancelled clinic/counseling session (its filed
// documentation goes with it via cascade). Only cancelled sessions can be
// deleted — scheduled sessions must be finished or cancelled first, and
// completed sessions stay as the case history.
router.delete(
  "/:id/sessions/:sessionId",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      ensureOpen(referral);
      const session = await getSession(referral.id, String(req.params.sessionId));
      if (session.status !== "cancelled") {
        throw new AppError(400, "INVALID_ACTION", "Only a cancelled session can be deleted");
      }
      await prisma.counselingSession.delete({ where: { id: session.id } });
      await writeAudit({ userId: req.user!.id, actionType: "delete", sourceTable: "counseling_sessions", sourceId: session.id, reason: "Cancelled session deleted", oldValue: { status: session.status }, newValue: null });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

// Clinic documentation on one session: list / upload / remove image
// attachments. Filing is optional before closing a clinic case — these
// endpoints never gate resolve, they only build the evidence trail.
// Uploads are allowed on open cases (any session status except when the
// case itself is closed) so the nurse can file a photo after marking a
// session done — but a still-upcoming session unlocks only once its
// scheduled time arrives.
router.get(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "principal"),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      const session = await getSession(referral.id, String(req.params.sessionId));
      const rows = await prisma.clinicSessionAttachment.findMany({
        where: { sessionId: session.id },
        orderBy: { uploadedAt: "asc" },
      });
      res.json(rows.map(formatAttachment));
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  clinicUpload.array("files", 5),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      if (referral.status === "resolved" || referral.status === "dismissed") {
        throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a closed case");
      }
      const session = await getSession(referral.id, String(req.params.sessionId));
      // Documentation unlocks once the session time arrives — upcoming
      // sessions can still be viewed but cannot take new files yet.
      if (session.status === "scheduled") {
        ensureSessionStarted(session);
      }
      const files = ((req as unknown as { files?: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }> }).files ?? []);
      if (files.length === 0) {
        throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
      }
      const existing = await prisma.clinicSessionAttachment.count({
        where: { sessionId: session.id },
      });
      if (existing + files.length > 10) {
        throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
      }
      const created = [];
      for (const file of files) {
        const path = clinicSessionObjectPath(session.id, file.originalname);
        const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
        const row = await prisma.clinicSessionAttachment.create({
          data: {
            sessionId: session.id,
            fileUrl,
            fileName: file.originalname.slice(0, 200),
            mimeType: file.mimetype,
            fileSize: file.size,
            uploadedBy: req.user!.id,
          },
        });
        created.push(row);
      }
      await writeAudit({
        userId: req.user!.id,
        actionType: "session_document_added",
        sourceTable: "counseling_sessions",
        sourceId: session.id,
        reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
        oldValue: null,
        newValue: { count: created.length },
      });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.status(201).json(created.map(formatAttachment));
    } catch (e) { next(e); }
  }
);

router.delete(
  "/:id/sessions/:sessionId/attachments/:attachmentId",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const referral = await getSessionReferral(String(req.params.id), req.user!.role);
      if (referral.status === "resolved" || referral.status === "dismissed") {
        throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a closed case");
      }
      const session = await getSession(referral.id, String(req.params.sessionId));
      const row = await prisma.clinicSessionAttachment.findUnique({
        where: { id: String(req.params.attachmentId) },
      });
      if (!row || row.sessionId !== session.id) {
        throw new AppError(404, "NOT_FOUND", "Documentation not found");
      }
      await prisma.clinicSessionAttachment.delete({ where: { id: row.id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "session_document_added",
        sourceTable: "counseling_sessions",
        sourceId: session.id,
        reason: `Documentation removed: ${row.fileName}`,
        oldValue: { fileName: row.fileName },
        newValue: null,
      });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.json({ ok: true });
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
              createdAt: true,
              completedAt: true,
              attachments: {
                orderBy: { uploadedAt: "asc" },
                select: {
                  id: true,
                  fileUrl: true,
                  fileName: true,
                  mimeType: true,
                  fileSize: true,
                  uploadedAt: true,
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      });
      // Referral time = earliest audit entry for the referral (creation
      // always writes one). Legacy rows without an audit trail fall back
      // to the observation date so "waiting" never goes blank.
      // Last action = latest audit across the referral row AND its sessions
      // (session booked/done/cancelled/moved + status changes) so the DUI
      // shows the execution time, not the future appointment time.
      const ids = referrals.map((r) => r.id);
      const sessionIds = referrals.flatMap((r) => r.counselingSessions.map((s) => s.id));
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
      // Latest execution per referral: newest referral-level audit wins
      // unless a session-level audit on one of its sessions is newer.
      const lastActionById = new Map<string, { type: string; at: string }>();
      if (ids.length > 0 || sessionIds.length > 0) {
        const latestLogs = await prisma.auditLog.findMany({
          where: {
            OR: [
              ...(ids.length ? [{ sourceTable: "referrals", sourceId: { in: ids } }] : []),
              ...(sessionIds.length ? [{ sourceTable: "counseling_sessions", sourceId: { in: sessionIds } }] : []),
            ],
          },
          select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        const sessionToReferral = new Map<string, string>();
        for (const r of referrals) {
          for (const s of r.counselingSessions) sessionToReferral.set(s.id, r.id);
        }
        for (const log of latestLogs) {
          const referralId =
            log.sourceTable === "referrals"
              ? log.sourceId
              : (sessionToReferral.get(log.sourceId) ?? null);
          if (!referralId || lastActionById.has(referralId)) continue;
          lastActionById.set(referralId, {
            type: String(log.actionType),
            at: log.createdAt.toISOString(),
          });
        }
      }
      res.json(
        referrals
          .map((r) => ({
            ...r,
            referredAt:
              referredAtById.get(r.id) ??
              r.anecdotalRecord?.observationDatetime?.toISOString() ??
              null,
            lastActionAt: lastActionById.get(r.id)?.at ?? null,
            lastActionType: lastActionById.get(r.id)?.type ?? null,
          }))
          // Latest referred on top — the nurse referrals queue is a
          // newest-first timeline. (Referral ids are uuids, so the DB
          // orderBy above carries no chronology; referredAt does.)
          .sort((a, b) => {
            const at = a.referredAt ?? "";
            const bt = b.referredAt ?? "";
            if (at === bt) return 0;
            return bt < at ? -1 : 1;
          }),
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