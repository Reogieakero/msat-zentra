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
  requireRole("guidance_counselor", "principal"),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
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
  requireRole("guidance_counselor"),
  validate("body", sessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
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
  requireRole("guidance_counselor"),
  validate("body", completeSessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
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
  requireRole("guidance_counselor"),
  validate("body", rescheduleSchema),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
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
  requireRole("guidance_counselor"),
  validate("body", cancelSessionSchema),
  async (req, res, next) => {
    try {
      const referral = await getGuidanceReferral(String(req.params.id));
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
      const referrals = await prisma.referral.findMany({ include: { anecdotalRecord: true, student: true, roster: true }, orderBy: { id: "asc" } });
      res.json(referrals);
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
          admReceiver: isAdm ? "adm_coordinator" : null,
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