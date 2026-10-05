import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";
import {
  TIMELINE_DESK_LABELS,
  buildCaseTimeline,
} from "./timeline.js";

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

// Detailed notification cards: every referral fanout names the student +
// section (+ session when/venue or reason snippet where relevant) instead of
// a bare "your referral was updated". Key phrases stay contiguous so the
// frontend `toastTitleFor` matchers keep matching (details ride at the end).
function truncate(text: string | null | undefined, max = 100): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

function formatWhen(d: Date): string {
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

interface ReferralCard {
  /** e.g. "Maria Santos (G7 – Ruby)" or "Maria Santos" when section is unknown. */
  who: string;
  studentName: string;
  sectionName: string;
  filerName: string;
}

async function referralCard(referral: {
  studentId: string | null;
  rosterId: string | null;
  referredBy: string | null;
}): Promise<ReferralCard> {
  // Note: referral.studentId is a User id (registered students file under
  // their account), so names resolve through User, not StudentProfile.
  const [account, roster, filer] = await Promise.all([
    referral.studentId
      ? prisma.user.findUnique({
          where: { id: referral.studentId },
          select: {
            fullName: true,
            studentProfile: { select: { section: { select: { name: true } } } },
          },
        })
      : null,
    referral.rosterId
      ? prisma.studentRoster.findUnique({
          where: { id: referral.rosterId },
          select: { fullName: true, section: { select: { name: true } } },
        })
      : null,
    referral.referredBy
      ? prisma.user.findUnique({
          where: { id: referral.referredBy },
          select: { fullName: true },
        })
      : null,
  ]);
  const studentName = account?.fullName ?? roster?.fullName ?? "the student";
  const sectionName =
    account?.studentProfile?.section?.name ?? roster?.section?.name ?? "";
  return {
    who: sectionName ? `${studentName} (${sectionName})` : studentName,
    studentName,
    sectionName,
    filerName: filer?.fullName ?? "the filing teacher",
  };
}

/* Display name of the acting user for handoff messages — one lookup per
   call site, "Someone" fallback so a deleted/renamed account never blanks
   the notification. */
async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  return u?.fullName ?? "Someone";
}

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
      const card = await referralCard(referral);
      res.json(updated);
      // Realtime handoff: the filing adviser learns the case moved — clinic
      // matters notify the adviser only (never the coordinator). Best-effort.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const nextStatus = String(req.body.status);
        const isClinic = onNurseClinicDesk || req.user!.role === "nurse";
        const isGuidance =
          referral.referredToRole === "guidance_counselor" ||
          req.user!.role === "guidance_counselor";
        let message = `Your referral for ${card.who} was updated.`;
        if (nextStatus === "resolved") {
          message = isClinic
            ? `Clinic resolved your referral for ${card.who} — case closed.`
            : isGuidance
              ? `Guidance resolved your referral for ${card.who} — case closed.`
              : `Your referral for ${card.who} was marked resolved.`;
        } else if (nextStatus === "info_requested") {
          message = isClinic
            ? `Clinic requested more info on your referral for ${card.who}.`
            : `More info was requested on your referral for ${card.who}.`;
        } else if (nextStatus === "follow_up") {
          message = isClinic
            ? `Clinic set a follow-up for ${card.who}.`
            : `A follow-up was set for your referral for ${card.who}.`;
        } else if (nextStatus === "in_progress") {
          message = isClinic
            ? `The clinic started handling your referral for ${card.who}.`
            : `Your referral for ${card.who} is now in progress.`;
        } else if (nextStatus === "dismissed") {
          message = isClinic
            ? `Your clinic referral for ${card.who} was closed.`
            : `Your referral for ${card.who} was dismissed.`;
        } else if (nextStatus === "escalated") {
          message = `Your referral for ${card.who} was escalated.`;
        } else if (nextStatus === "pending") {
          message = `Your referral for ${card.who} is pending review again.`;
        }
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message,
          sourceId: referral.id,
        });
      }
      // Nurse receipt: the acting nurse also gets a bell row (not just the
      // local success toast) so their inbox reflects what they did.
      if (req.user!.role === "nurse") {
        const nextStatus = String(req.body.status);
        let selfMessage: string | null = null;
        if (nextStatus === "resolved") {
          selfMessage = `You marked a clinic referral for ${card.who} resolved — case closed.`;
        } else if (nextStatus === "info_requested") {
          selfMessage = `You requested more info on a clinic referral for ${card.who}.`;
        } else if (nextStatus === "follow_up") {
          selfMessage = `You set a follow-up on a clinic referral for ${card.who}.`;
        } else if (nextStatus === "in_progress") {
          selfMessage = `You started handling a clinic referral for ${card.who}.`;
        } else if (nextStatus === "dismissed") {
          selfMessage = `You closed a clinic referral for ${card.who}.`;
        } else if (nextStatus === "pending") {
          selfMessage = `You moved a clinic referral for ${card.who} back to pending.`;
        }
        if (selfMessage) {
          void fanoutNotification({
            userId: req.user!.id,
            sourceTable: "referrals",
            action: "status",
            message: selfMessage,
            sourceId: referral.id,
          });
        }
      }
      // Counselor receipt: same bell-row bargain for the acting counselor.
      if (req.user!.role === "guidance_counselor") {
        const nextStatus = String(req.body.status);
        let selfMessage: string | null = null;
        if (nextStatus === "resolved") {
          selfMessage = `You marked a guidance referral for ${card.who} resolved — case closed.`;
        } else if (nextStatus === "info_requested") {
          selfMessage = `You requested more info on a guidance referral for ${card.who}.`;
        } else if (nextStatus === "follow_up") {
          selfMessage = `You set a follow-up on a guidance referral for ${card.who}.`;
        } else if (nextStatus === "in_progress") {
          selfMessage = `You started handling a guidance referral for ${card.who}.`;
        } else if (nextStatus === "dismissed") {
          selfMessage = `You closed a guidance referral for ${card.who}.`;
        } else if (nextStatus === "pending") {
          selfMessage = `You moved a guidance referral for ${card.who} back to pending.`;
        }
        if (selfMessage) {
          void fanoutNotification({
            userId: req.user!.id,
            sourceTable: "referrals",
            action: "status",
            message: selfMessage,
            sourceId: referral.id,
          });
        }
      }
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
      const card = await referralCard(referral);
      const why = truncate(req.body.escalationReason, 120);
      const actor = await actorName(req.user!.id);
      res.json(updated);
      // Escalation handoff: the receiving desk learns immediately — each
      // recipient's row names the actor AND the recipient ("…to you, {name}").
      if (req.body.escalatedTo === "nurse") {
        void fanoutToRole("nurse", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was escalated to the clinic — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
        });
      } else if (req.body.escalatedTo === "adm_coordinator") {
        void fanoutToRole("adm_coordinator", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was escalated to ADM — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
        });
      } else if (req.body.escalatedTo === "principal") {
        void fanoutToRole("principal", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was escalated to the principal — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} escalated ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
        });
      }
      // The filing adviser learns where the case went — naming the actor.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const dest =
          req.body.escalatedTo === "nurse"
            ? "the clinic"
            : req.body.escalatedTo === "adm_coordinator"
              ? "ADM"
              : "the principal";
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `${actor} escalated your referral for ${card.who} to ${dest}.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      {
        const dest =
          req.body.escalatedTo === "nurse"
            ? "the clinic"
            : req.body.escalatedTo === "adm_coordinator"
              ? "ADM"
              : "the principal";
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You escalated a referral for ${card.who} to ${dest}.`,
          sourceId: referral.id,
        });
      }
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
        data: { status: "dismissed", notes: req.body.reason },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      const actor = await actorName(req.user!.id);
      res.json(updated);
      // Reassignment handoff: the new owning desk learns immediately — each
      // recipient's row names the actor AND the recipient.
      if (req.body.referredToRole === "nurse") {
        void fanoutToRole("nurse", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was reassigned to the clinic — ${card.who}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
        });
      } else if (req.body.referredToRole === "adm_coordinator") {
        void fanoutToRole("adm_coordinator", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was reassigned to ADM — ${card.who}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
        });
      } else if (req.body.referredToRole === "guidance_counselor") {
        void fanoutToRole("guidance_counselor", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was reassigned to guidance — ${card.who}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} reassigned ${card.who} to you, ${r.fullName}.`,
        });
      }
      // The filing adviser learns where the case went — naming the actor.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const dest =
          req.body.referredToRole === "nurse"
            ? "the clinic"
            : req.body.referredToRole === "adm_coordinator"
              ? "ADM"
              : req.body.referredToRole === "guidance_counselor"
                ? "guidance"
                : "the principal";
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `${actor} reassigned your referral for ${card.who} to ${dest}.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      {
        const dest =
          req.body.referredToRole === "nurse"
            ? "the clinic"
            : req.body.referredToRole === "adm_coordinator"
              ? "ADM"
              : req.body.referredToRole === "guidance_counselor"
                ? "guidance"
                : "the principal";
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You reassigned a referral for ${card.who} to ${dest}.`,
          sourceId: referral.id,
        });
      }
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
        data: { status: "dismissed", notes: req.body.reason },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `Your referral for ${card.who} was dismissed.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You dismissed a referral for ${card.who}.`,
        sourceId: referral.id,
      });
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
        data: { status: "dismissed", notes: req.body.reason },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `A follow-up was set for your referral for ${card.who} — ${req.body.followUpDate}.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You set a follow-up for ${card.who} — ${req.body.followUpDate}.`,
        sourceId: referral.id,
      });
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
      const card = await referralCard(referral);
      const why = truncate(req.body.reason, 120);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `Your referral for ${card.who} was dismissed${why ? ` — ${why}` : ""}.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You dismissed a referral for ${card.who}.`,
        sourceId: referral.id,
      });
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
      const card = await referralCard(referral);
      const why = truncate(req.body.reason, 120);
      const actor = await actorName(req.user!.id);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const dest =
          req.body.referredToRole === "nurse"
            ? "the clinic"
            : req.body.referredToRole === "adm_coordinator"
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
      if (req.body.referredToRole === "nurse") {
        void fanoutToRole("nurse", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was referred to the clinic — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
        });
      } else if (req.body.referredToRole === "adm_coordinator") {
        void fanoutToRole("adm_coordinator", {
          sourceTable: "referrals",
          action: "status",
          message: `A case was referred to ADM — ${card.who}${why ? `: ${why}` : ""}. Filed by ${card.filerName}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      {
        const dest =
          req.body.referredToRole === "nurse"
            ? "the clinic"
            : req.body.referredToRole === "adm_coordinator"
              ? "ADM"
              : "the principal";
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You sent a referral for ${card.who} to ${dest}.`,
          sourceId: referral.id,
        });
      }
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
      const card = await referralCard(referral);
      const why = truncate(req.body.reason, 120);
      const actor = await actorName(req.user!.id);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
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
        excludeUserId: req.user!.id,
        messageFor: (r) =>
          `${actor} referred ${card.who} to you, ${r.fullName}${why ? `: ${why}` : ""}.`,
      });
      // Counselor receipt: bell row for the acting counselor.
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You sent a referral for ${card.who} to ADM.`,
        sourceId: referral.id,
      });
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
      const card = await referralCard(referral);
      res.json(updated);
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `Guidance accepted your referral for ${card.who} — now in progress${req.body.firstSession ? " with a first session booked" : ""}.`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor (not just the
      // local success toast) so their inbox reflects what they did.
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You accepted a guidance referral for ${card.who} — now in progress.`,
        sourceId: referral.id,
      });
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
            intakeNotes: req.body.intakeNotes?.trim() ? req.body.intakeNotes.trim() : null,
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
              venue: req.body.clinicSession?.venue?.trim() || "School clinic",
              status: "scheduled",
              createdBy: req.user!.id,
            },
            include: { creator: { select: { fullName: true } } },
          });
        }
        return { updated: updatedRow, session: sessionRow };
      });
      if (session) {
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `First clinic session booked on accept`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
      }
      await writeAudit({ userId: req.user!.id, actionType: "referral_accepted", sourceTable: "referrals", sourceId: referral.id, reason: `Accepted by the clinic${session ? " with a clinic session booked" : ""}`, oldValue: { status: referral.status }, newValue: { status: "in_progress" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      const sessionBit = session
        ? ` with a first session ${formatWhen(session.scheduledAt)} at ${session.venue || "School clinic"}`
        : "";
      res.json({ referral: updated, clinicSession: session ? formatSession(session) : null });
      // The referring adviser learns the clinic picked the case up.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
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
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You accepted a clinic referral for ${card.who} — now in progress${sessionBit}.`,
        sourceId: referral.id,
      });
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
            clinicInput && typeof clinicInput.venue === "string" && clinicInput.venue.trim()
              ? clinicInput.venue.trim()
              : "School clinic";
          sessionRow = await tx.counselingSession.create({
            data: {
              referralId: referral.id,
              sessionType: "individual",
              scheduledAt: sessionAt,
              venue,
              status: "scheduled",
              createdBy: req.user!.id,
            },
            include: { creator: { select: { fullName: true } } },
          });
        }
        return { updated: updatedRow, session: sessionRow };
      });
      if (session) {
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `Clinic session booked on ADM review`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
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
      const card = await referralCard(referral);
      const recNote = truncate(recommendation.trim(), 120);
      const actor = await actorName(req.user!.id);
      res.json(updated);
      // Nurse consultation endorse hands the case to the ADM coordinators
      // (coordinator toast kept); the filing adviser learns the outcome too.
      if (outcome === "endorse") {
        void fanoutToRole("adm_coordinator", {
          sourceTable: "referrals",
          action: "status",
          message: `ADM consultation endorsed — ${card.who} ready for the parent meeting${recNote ? `: ${recNote}` : ""}${session ? ` (clinic session ${formatWhen(session.scheduledAt)})` : ""}.`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actor} endorsed the ADM consultation for ${card.who} — sent to you, ${r.fullName}${recNote ? `: ${recNote}` : ""}.`,
        });
        if (referral.referredBy && referral.referredBy !== req.user!.id) {
          void fanoutNotification({
            userId: referral.referredBy,
            sourceTable: "referrals",
            action: "status",
            message: `${actor} endorsed the ADM consultation for ${card.who} — now with the coordinator.`,
            sourceId: referral.id,
          });
        }
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You endorsed an ADM consultation for ${card.who} — sent to the coordinator.`,
          sourceId: referral.id,
        });
      } else {
        if (referral.referredBy && referral.referredBy !== req.user!.id) {
          void fanoutNotification({
            userId: referral.referredBy,
            sourceTable: "referrals",
            action: "status",
            message: `Your ADM referral for ${card.who} was not endorsed — case closed${recNote ? `: ${recNote}` : ""}.`,
            sourceId: referral.id,
          });
        }
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You did not endorse an ADM referral for ${card.who} — case closed.`,
          sourceId: referral.id,
        });
      }
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
      const { recommendation } = req.body as { recommendation: string };
      const clinicInput = (req.body as { clinicSession?: { scheduledAt?: unknown; venue?: unknown } }).clinicSession;
      const sessionAt = parseNurseAdmSession(clinicInput);
      const formInput = (req.body as { referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown } }).referralForm;
      const formParts = buildAdmReferralFormNote(formInput);
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
            clinicInput && typeof clinicInput.venue === "string" && clinicInput.venue.trim()
              ? clinicInput.venue.trim()
              : "School clinic";
          sessionRow = await tx.counselingSession.create({
            data: {
              referralId: referral.id,
              sessionType: "individual",
              scheduledAt: sessionAt,
              venue,
              status: "scheduled",
              createdBy: req.user!.id,
            },
            include: { creator: { select: { fullName: true } } },
          });
        }
        return { updated: updatedRow, session: sessionRow };
      });
      if (session) {
        await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: session.id, reason: `Clinic session booked with ADM referral form`, oldValue: null, newValue: { sessionType: session.sessionType, scheduledAt: session.scheduledAt } });
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
      const card = await referralCard(referral);
      res.json(updated);
      // Form-save handoff (background, off the critical path): the filing
      // adviser and the acting nurse each get a bell row. Uses action
      // "form" (NOT "status") so the 60s per-user dedup can never swallow
      // the seconds-later forward handoff for any recipient.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "form",
          message: `The clinic completed the referral form for ${card.who} — ready to forward.`,
          sourceId: referral.id,
        });
      }
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "form",
        message: `You completed the referral form for ${card.who} — ready to forward.`,
        sourceId: referral.id,
      });
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
      const card = await referralCard(referral);
      res.json(updated);
      // Explicit forward hands the case to the ADM coordinators (coordinator
      // toast kept); the filing adviser learns the case moved too.
      void fanoutToRole("adm_coordinator", {
        sourceTable: "referrals",
        action: "status",
        message: `ADM consultation endorsed — ${card.who} ready for the parent meeting.`,
        sourceId: referral.id,
        excludeUserId: req.user!.id,
      });
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `Your ADM referral for ${card.who} was forwarded to the coordinator.`,
          sourceId: referral.id,
        });
      }
      void fanoutNotification({
        userId: req.user!.id,
        sourceTable: "referrals",
        action: "status",
        message: `You forwarded an ADM referral for ${card.who} to the coordinator.`,
        sourceId: referral.id,
      });
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
      // Atomic booking: active-session guard + create + pending→in_progress
      // flip in one transaction to close the rapid double-click race.
      const created = await prisma.$transaction(async (tx) => {
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
        const row = await tx.counselingSession.create({
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
        // Booking is handling: a still-pending referral leaves "Needs review"
        // the moment its first session is booked (mirrors nurse-accept).
        // ADM consultations never flip here — on ADM track in_progress IS
        // the endorsed state, and endorsing happens only through the
        // explicit Create-referral/forward flow (completed form required).
        // A pre-confirm booking from the ADM review leaves the case pending.
        if (referral.status === "pending" && referral.referredToRole !== "adm_coordinator") {
          await tx.referral.update({
            where: { id: referral.id },
            data: { status: "in_progress" },
          });
        }
        return row;
      });
      await writeAudit({ userId: req.user!.id, actionType: "session_scheduled", sourceTable: "counseling_sessions", sourceId: created.id, reason: "Counseling session scheduled", oldValue: null, newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt } });
      if (referral.status === "pending" && referral.referredToRole !== "adm_coordinator") {
        await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: "Session booked — case now in progress", oldValue: { status: "pending" }, newValue: { status: "in_progress" } });
      }
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      const when = formatWhen(created.scheduledAt);
      const where = created.venue ? ` at ${created.venue}` : "";
      const actor = await actorName(req.user!.id);
      const actorLabel =
        req.user!.role === "nurse"
          ? `${actor} (Clinic)`
          : `${actor} (Guidance)`;
      res.status(201).json(formatSession(created));
      // Session booking is handling — the filing adviser learns live, naming
      // who booked it. Clinic matters stay adviser-only (never fan out to
      // the coordinator).
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const message = `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}).`;
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message,
          sourceId: referral.id,
        });
      }
      // Consultation reviewer: on ADM-track cases the other desk's
      // reviewer (nurse ↔ guidance) learns about the booking too, so
      // everyone connected to the student — guidance, nurse, adviser —
      // is reminded live. Skipped when the reviewer is the actor.
      if (
        referral.referredToRole === "adm_coordinator" &&
        (referral.consultReviewer === "nurse" ||
          referral.consultReviewer === "guidance_counselor") &&
        referral.consultReviewer !== req.user!.role
      ) {
        void fanoutToRole(referral.consultReviewer, {
          sourceTable: "referrals",
          action: "status",
          message: `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}).`,
          sourceId: referral.id,
          excludeUserId: req.user!.id,
          messageFor: (r) =>
            `${actorLabel} booked a session for ${card.who} (${created.sessionType}, ${when}${where}) — sent to you, ${r.fullName}.`,
        });
      }
      // Nurse receipt: bell row for the acting nurse.
      if (req.user!.role === "nurse") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You booked a clinic session for ${card.who} (${created.sessionType}, ${when}${where}).`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      if (req.user!.role === "guidance_counselor") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You booked a guidance session for ${card.who} (${created.sessionType}, ${when}${where}).`,
          sourceId: referral.id,
        });
      }
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
      const card = await referralCard(referral);
      const didWhen = formatWhen(session.scheduledAt);
      res.json(formatSession(updated));
      // The filing adviser learns the session outcome live (adviser-only —
      // clinic matters never fan out to the coordinator). Status-only: no
      // clinical notes leave this message.
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        const message = req.body.followUpSession
          ? req.user!.role === "nurse"
            ? `Clinic set a follow-up for ${card.who} — next session ${formatWhen(parseScheduledAt(req.body.followUpSession.scheduledAt))}.`
            : `A follow-up was set for your referral for ${card.who}.`
          : req.user!.role === "nurse"
            ? `Clinic completed a session for ${card.who} (${session.sessionType}, ${didWhen}).`
            : `Guidance completed a session for ${card.who} (${session.sessionType}, ${didWhen}).`;
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message,
          sourceId: referral.id,
        });
      }
      // Nurse receipt: bell row for the acting nurse.
      if (req.user!.role === "nurse") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: req.body.followUpSession
            ? `You completed a session for ${card.who} and set a follow-up (${formatWhen(parseScheduledAt(req.body.followUpSession.scheduledAt))}).`
            : `You completed a clinic session for ${card.who} (${session.sessionType}, ${didWhen}).`,
          sourceId: referral.id,
        });
      }
      // Counselor receipt: bell row for the acting counselor.
      if (req.user!.role === "guidance_counselor") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: req.body.followUpSession
            ? `You completed a session for ${card.who} and set a follow-up (${formatWhen(parseScheduledAt(req.body.followUpSession.scheduledAt))}).`
            : `You completed a guidance session for ${card.who} (${session.sessionType}, ${didWhen}).`,
          sourceId: referral.id,
        });
      }
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
      const card = await referralCard(referral);
      const was = formatWhen(session.scheduledAt);
      const now = formatWhen(nextDate);
      res.json(formatSession(updated));
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message:
            req.user!.role === "nurse"
              ? `Clinic rescheduled a session for ${card.who} — now ${now} (was ${was}).`
              : `Guidance rescheduled a session for ${card.who} — now ${now} (was ${was}).`,
          sourceId: referral.id,
        });
      }
      if (req.user!.role === "nurse") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You rescheduled a clinic session for ${card.who} — now ${now} (was ${was}).`,
          sourceId: referral.id,
        });
      }
      if (req.user!.role === "guidance_counselor") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You rescheduled a guidance session for ${card.who} — now ${now} (was ${was}).`,
          sourceId: referral.id,
        });
      }
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
      const card = await referralCard(referral);
      const was = formatWhen(session.scheduledAt);
      const why = truncate(req.body.cancelReason, 120);
      res.json(formatSession(updated));
      if (referral.referredBy && referral.referredBy !== req.user!.id) {
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message:
            req.user!.role === "nurse"
              ? `Clinic cancelled a session for ${card.who} (${session.sessionType}, ${was})${why ? ` — ${why}` : ""}.`
              : `Guidance cancelled a session for ${card.who} (${session.sessionType}, ${was})${why ? ` — ${why}` : ""}.`,
          sourceId: referral.id,
        });
      }
      if (req.user!.role === "nurse") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You cancelled a clinic session for ${card.who} (${session.sessionType}, ${was}).`,
          sourceId: referral.id,
        });
      }
      if (req.user!.role === "guidance_counselor") {
        void fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: `You cancelled a guidance session for ${card.who} (${session.sessionType}, ${was}).`,
          sourceId: referral.id,
        });
      }
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
      // Who dismissed it — adviser withdrawal ("Cancelled" watermark) vs
      // desk rejection ("Reject"). Latest dismissal audit wins; rows never
      // dismissed stay null.
      const dismissedByRole = new Map<string, string>();
      if (ids.length > 0) {
        const dismissalLogs = await prisma.auditLog.findMany({
          where: {
            sourceTable: "referrals",
            sourceId: { in: ids },
            actionType: "referral_dismissed",
          },
          select: { sourceId: true, user: { select: { role: true } } },
          orderBy: { createdAt: "desc" },
        });
        for (const log of dismissalLogs) {
          if (!dismissedByRole.has(log.sourceId)) {
            dismissedByRole.set(log.sourceId, String(log.user?.role ?? ""));
          }
        }
      }
      // Who cancelled each session — desk cancel vs the adviser-withdrawal
      // auto-cancel cascade (audit actor is the filing teacher there).
      const cancelledByRole = await sessionCancelledByRole(sessionIds);
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
            counselingSessions: r.counselingSessions.map((s) => ({
              ...s,
              cancelledByRole: cancelledByRole.get(s.id) ?? null,
            })),
            referredAt:
              referredAtById.get(r.id) ??
              r.anecdotalRecord?.observationDatetime?.toISOString() ??
              null,
            lastActionAt: lastActionById.get(r.id)?.at ?? null,
            lastActionType: lastActionById.get(r.id)?.type ?? null,
            dismissedByRole: dismissedByRole.get(r.id) ?? null,
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

// Timeline helpers (labels, desk names, per-case audit timelines) live in
// ./timeline.js, shared with the ADM my-cases endpoint so both teacher
// surfaces tell the same story.

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
      // Term-scoped: a referral filed in another term never leaks into this
      // term's list — each term shows only transactions executed under it.
      // Linking the teacher code again in a new term grants access; it does
      // not copy prior terms' rows over.
      const scopeTermId = req.termScope?.termId ?? null;
      const referralWhere = {
        referredBy: teacherId,
        ...(scopeTermId ? { termId: scopeTermId } : {}),
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
              modules: { select: { submitted: true, submissionDate: true } },
              devices: { select: { returnedDate: true } },
              forms: { select: { formType: true, status: true, uploadedAt: true } },
            },
          },
        },
        orderBy: { id: "desc" },
      });

      const referralIds = referrals.map((r) => r.id);
      // Shared audit timeline (referral + session actions, actor roles,
      // full timestamps) — same builder the ADM my-cases endpoint uses.
      const timelines = await buildCaseTimeline(referralIds);
      // Approver roles for the principal-signature entries (one query).
      const approverIds = [
        ...new Set(
          referrals
            .map((r) => r.admProfiles[0]?.approvedBy ?? null)
            .filter((v): v is string => !!v)
        ),
      ];
      const approverRoles = new Map<string, string>();
      if (approverIds.length > 0) {
        const approvers = await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, role: true },
        });
        for (const a of approvers) approverRoles.set(a.id, String(a.role));
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

        const timeline = timelines.get(r.id) ?? [];
        const referredAt =
          timeline[0]?.at ?? new Date().toISOString();
        if (timeline.length === 0) {
          timeline.push({
            label: `Submitted to the ${TIMELINE_DESK_LABELS[r.referredToRole] ?? "receiving desk"}.`,
            detail: null,
            date: referredAt.slice(0, 10),
            at: referredAt,
            action: "referral_submitted",
            byRole: null,
            source: "case",
          });
        }
        if (profile) {
          timeline.push({
            label: `Moved to the ${admLabelByStage.get(profile.stage) ?? profile.stage} stage.`,
            detail: null,
            date: profile.createdAt.toISOString().slice(0, 10),
            at: profile.createdAt.toISOString(),
            action: "adm_stage",
            byRole: "adm_coordinator",
            source: "case",
            stage: profile.stage,
          });
        }
        if (profile?.approvedBy && profile.approvedAt) {
          timeline.push({
            label: "The principal signed the approval.",
            detail: null,
            date: profile.approvedAt.toISOString().slice(0, 10),
            at: profile.approvedAt.toISOString(),
            action: "adm_approved",
            byRole: approverRoles.get(profile.approvedBy) ?? "principal",
            source: "case",
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
          resolvedAt: r.status === "resolved" ? (timeline[timeline.length - 1]?.at ?? new Date().toISOString()) : null,
          anecdotalId: r.anecdotalRecordId,
          observationDate: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
          anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
          category: r.anecdotalRecord.category,
          track: isAdm ? "adm" : "general",
          // Truthful routing: the teacher-picked consultation reviewer, or
          // the coordinator for legacy rows without a stored pick.
          admReceiver: isAdm ? (r.consultReviewer ?? "adm_coordinator") : null,
          consultReviewer: r.consultReviewer ?? null,
          hasParentMeeting,
          meetingAttended,
          hasHomeVisit,
          admStage,
          admStageLabel: admStage ? (admLabelByStage.get(admStage) ?? admStage) : null,
          admEligibility: profile?.eligibilityStatus ?? null,
          admApproved: !!profile?.approvedBy,
          admApprovedAt: profile?.approvedAt ? profile.approvedAt.toISOString() : null,
          // Stage evidence for the shared tracker (status-only counts and
          // timestamps — same shape as adm/my-cases so both pages match).
          modulesSubmitted: (profile?.modules ?? []).filter((m) => m.submitted).length,
          modulesTotal: (profile?.modules ?? []).length,
          lastModuleAt: (() => {
            const dates = (profile?.modules ?? [])
              .filter((m) => m.submitted && m.submissionDate)
              .map((m) => (m.submissionDate as Date).toISOString());
            return dates.length > 0 ? dates.sort().slice(-1)[0] : null;
          })(),
          devicesReturned: (profile?.devices ?? []).filter((d) => d.returnedDate !== null).length,
          certificationAt: (() => {
            const cert = (profile?.forms ?? []).find(
              (f) => f.formType === "CERTIFICATION" && f.status === "verified" && f.uploadedAt
            );
            return cert?.uploadedAt ? (cert.uploadedAt as Date).toISOString() : null;
          })(),
          lastMeetingAt:
            meetings.length > 0 && meetings[0].meetingDatetime
              ? (meetings[0].meetingDatetime as Date).toISOString()
              : null,
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

// Adviser-initiated cancel: the teacher who filed the referral withdraws it
// at any time while the case is still open (any non-terminal status). Lands
// on the same terminal "dismissed" state the guidance dismiss flow uses,
// with the adviser's reason kept in notes.
const adviserCancelSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

router.post(
  "/:id/cancel",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", adviserCancelSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.referredBy !== req.user!.id) {
        throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can cancel it");
      }
      if (referral.status === "dismissed") {
        throw new AppError(400, "INVALID_ACTION", "This referral is already cancelled");
      }
      if (referral.status === "resolved") {
        throw new AppError(400, "INVALID_ACTION", "A resolved referral cannot be cancelled");
      }
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "dismissed", notes: req.body.reason },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_dismissed", sourceTable: "referrals", sourceId: referral.id, reason: req.body.reason, oldValue: { status: referral.status }, newValue: { status: "dismissed" } });
      // Cascade: booked (still-scheduled) sessions die with the referral —
      // a withdrawn case must never keep an upcoming booking on any desk's
      // calendar. Completed sessions stay as history; only scheduled ones
      // flip, each with its own audit so timelines stay truthful.
      const AUTO_CANCEL_REASON = "Auto-cancelled — referral withdrawn by the filing teacher";
      const booked = await prisma.counselingSession.findMany({
        where: { referralId: referral.id, status: "scheduled" },
        select: { id: true, status: true },
      });
      if (booked.length > 0) {
        await prisma.counselingSession.updateMany({
          where: { referralId: referral.id, status: "scheduled" },
          data: { status: "cancelled", cancelReason: AUTO_CANCEL_REASON },
        });
        for (const s of booked) {
          await writeAudit({ userId: req.user!.id, actionType: "session_cancelled", sourceTable: "counseling_sessions", sourceId: s.id, reason: AUTO_CANCEL_REASON, oldValue: { status: s.status }, newValue: { status: "cancelled" } });
        }
      }
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      res.json(updated);
      // Realtime handoff (background, off the critical path): the receiving
      // desk learns the case was withdrawn, the consultation reviewer (if
      // any) stops work, and the filing teacher gets a bell confirmation.
      // Best-effort — never delays the response.
      {
        const actorId = req.user!.id;
        const role = referral.referredToRole as
          | "nurse"
          | "guidance_counselor"
          | "adm_coordinator"
          | "principal";
        const cascadeNote =
          booked.length > 0
            ? ` (${booked.length} booked session${booked.length === 1 ? "" : "s"} auto-cancelled).`
            : "";
        void fanoutToRole(role, {
          sourceTable: "referrals",
          action: "status",
          message: `A referral to your desk was withdrawn by the filing teacher — ${card.who}.${cascadeNote}`,
          sourceId: referral.id,
          excludeUserId: actorId,
        });
        if (
          role === "adm_coordinator" &&
          (referral.consultReviewer === "nurse" ||
            referral.consultReviewer === "guidance_counselor")
        ) {
          void fanoutToRole(referral.consultReviewer, {
            sourceTable: "referrals",
            action: "status",
            message: `An ADM referral under your review was withdrawn — ${card.who}.${cascadeNote}`,
            sourceId: referral.id,
            excludeUserId: actorId,
          });
        }
        void fanoutNotification({
          userId: actorId,
          sourceTable: "referrals",
          action: "status",
          message: `You withdrew a referral for ${card.who}.${cascadeNote}`,
          sourceId: referral.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Adviser reopen: re-submit the teacher's own cancelled (dismissed)
// referral. The SAME row flips back to pending (never a duplicate row),
// so a submitted → cancelled → submitted case reads pending, not dismissed.
// An optional new destination (type) may be picked: omitted keeps the
// original desk. Guards mirror creation: own referral, dismissed-only, and
// no other open ADM case for the student when the final desk is ADM.
const reopenSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]).optional(),
  consultReviewer: z.enum(["nurse", "guidance_counselor", "lrpc"]).optional(),
}).strict();
router.post(
  "/:id/reopen",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", reopenSchema),
  async (req, res, next) => {
    try {
       const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
       if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
       if (referral.referredToRole === "adm_coordinator") {
         throw new AppError(400, "INVALID_ACTION", "Cancelled ADM cases cannot be re-submitted — start a new referral from the beginning.");
       }
       if (referral.referredBy !== req.user!.id) {
         throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can re-submit it");
       }
       if (referral.status !== "dismissed") {
         throw new AppError(400, "INVALID_ACTION", "Only a cancelled referral can be re-submitted");
       }
      const nextRole = req.body.referredToRole ?? referral.referredToRole;
      const nextReviewer = nextRole === "adm_coordinator" ? (req.body.consultReviewer ?? null) : null;
      if (req.body.consultReviewer && nextRole !== "adm_coordinator") {
        throw new AppError(400, "INVALID_ACTION", "A consultation reviewer can only be picked for ADM cases");
      }
      if (nextRole === "adm_coordinator") {
        const studentMatch = referral.studentId
          ? { studentId: referral.studentId }
          : { rosterId: referral.rosterId };
        const existingAdm = await prisma.referral.findFirst({
          where: {
            referredToRole: "adm_coordinator",
            status: { notIn: ["dismissed", "resolved"] },
            termId: referral.termId,
            ...studentMatch,
          },
          select: { id: true },
        });
        if (existingAdm) {
          throw new AppError(409, "ADM_CASE_EXISTS", "This student already has an open ADM case — only one ADM referral per student");
        }
      }
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: "pending", notes: null, referredToRole: nextRole, consultReviewer: nextReviewer },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Cancelled referral re-submitted by the filing teacher${nextRole !== referral.referredToRole ? ` (new desk: ${nextRole})` : ""}`, oldValue: { status: referral.status }, newValue: { status: "pending" } });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      const card = await referralCard(referral);
      res.json(updated);
      // Realtime handoff (background, off the critical path): the receiving
      // desk, the consultation reviewer (if any), and the filing teacher all
      // learn the case is live again. Best-effort — never delays the response.
      {
        const actorId = req.user!.id;
        const role = nextRole as
          | "nurse"
          | "guidance_counselor"
          | "adm_coordinator"
          | "principal";
        const roleMessage: Record<typeof role, string> = {
          adm_coordinator: `A cancelled ADM referral was re-submitted — ${card.who}.`,
          nurse: `A cancelled clinic referral was re-submitted — ${card.who}.`,
          guidance_counselor: `A cancelled guidance referral was re-submitted — ${card.who}.`,
          principal: `A cancelled principal referral was re-submitted — ${card.who}.`,
        };
        // Step-scoped notify (mirrors filing): a re-submitted ADM case with
        // a nurse/guidance reviewer sits at the reviewer's step — only the
        // reviewer is pinged, and the coordinator learns about it at endorse
        // time. Direct and lrpc re-submits still ping the coordinator.
        const reviewerOwned =
          role === "adm_coordinator" &&
          (nextReviewer === "nurse" || nextReviewer === "guidance_counselor");
        if (!reviewerOwned) {
          void fanoutToRole(role, {
            sourceTable: "referrals",
            action: "status",
            message: roleMessage[role],
            sourceId: referral.id,
            excludeUserId: actorId,
          });
        }
        if (
          role === "adm_coordinator" &&
          (nextReviewer === "nurse" || nextReviewer === "guidance_counselor")
        ) {
          void fanoutToRole(nextReviewer, {
            sourceTable: "referrals",
            action: "status",
            message: `A cancelled ADM referral under your review was re-submitted — ${card.who}.`,
            sourceId: referral.id,
            excludeUserId: actorId,
          });
        }
        void fanoutNotification({
          userId: actorId,
          sourceTable: "referrals",
          action: "status",
          message: `Your cancelled referral for ${card.who} was re-submitted.`,
          sourceId: referral.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Adviser delete: permanently remove the teacher's own referral from their
// list. Only a cancelled (dismissed) referral can be deleted, and only when
// nothing was ever recorded against it (no sessions, ADM artefacts, visits,
// or health records) — otherwise the evidence trail must stay intact.
router.delete(
  "/:id",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.referredBy !== req.user!.id) {
        throw new AppError(403, "FORBIDDEN", "Only the teacher who filed this referral can delete it");
      }
      if (referral.status !== "dismissed") {
        throw new AppError(400, "INVALID_ACTION", "Only a cancelled referral can be deleted");
      }
      const [sessions, profiles, meetings, visits, records] = await Promise.all([
        prisma.counselingSession.count({ where: { referralId: referral.id } }),
        prisma.admLearnerProfile.count({ where: { referralId: referral.id } }),
        prisma.admParentMeeting.count({ where: { referralId: referral.id } }),
        prisma.homeVisitationRecord.count({ where: { referralId: referral.id } }),
        prisma.healthRecord.count({ where: { referralId: referral.id } }),
      ]);
      if (sessions + profiles + meetings + visits + records > 0) {
        throw new AppError(400, "INVALID_ACTION", "This referral already has recorded activity and cannot be deleted");
      }
      await prisma.referral.delete({ where: { id: referral.id } });
      await writeAudit({ userId: req.user!.id, actionType: "delete", sourceTable: "referrals", sourceId: referral.id, reason: "Cancelled referral deleted by the filing teacher", oldValue: { status: referral.status }, newValue: null });
      await invalidateTags(["guidance", "overview", "alerts", "referrals", "adm", "teacher"]);
      res.status(204).end();
    } catch (e) { next(e); }
  }
);

export default router;