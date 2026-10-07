import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { REFERRAL_WRITE_TAGS } from "./referrals.repository.js";
import {
  cancelSessionSchema,
  completeSessionSchema,
  rescheduleSchema,
  sessionSchema,
} from "./referrals.schemas.js";
import {
  addAttachments,
  bookSession,
  cancelSession,
  completeSession,
  deleteSession,
  listAttachments,
  listSessions,
  removeAttachment,
  rescheduleSession,
  type SessionFile,
} from "../../services/referrals/sessions.service.js";

const router = Router();

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

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

router.get(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor", "principal", "nurse"),
  async (req, res, next) => {
    try {
      res.json(await listSessions(ctxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", sessionSchema),
  async (req, res, next) => {
    try {
      const created = await bookSession(ctxOf(req), String(req.params.id), {
        scheduledAt: req.body.scheduledAt as string,
        sessionType: req.body.sessionType as string,
        venue: req.body.venue as string | undefined,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/complete",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", completeSessionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        sessionNotes: string;
        outcome?: string;
        followUpSession?: { scheduledAt: string; sessionType: string; venue?: string };
      };
      const updated = await completeSession(ctxOf(req), String(req.params.id), String(req.params.sessionId), {
        sessionNotes: body.sessionNotes,
        outcome: body.outcome,
        followUpSession: body.followUpSession,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/reschedule",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", rescheduleSchema),
  async (req, res, next) => {
    try {
      const updated = await rescheduleSession(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        req.body.scheduledAt as string,
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/cancel",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  validate("body", cancelSessionSchema),
  async (req, res, next) => {
    try {
      const updated = await cancelSession(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        req.body.cancelReason as string | undefined,
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
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
      await deleteSession(ctxOf(req), String(req.params.id), String(req.params.sessionId));
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
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
      res.json(
        await listAttachments(ctxOf(req), String(req.params.id), String(req.params.sessionId)),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  clinicUpload.array("files", 5),
  async (req, res, next) => {
    try {
      const files = ((req as unknown as { files?: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }> }).files ?? []);
      const created = await addAttachments(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        files as SessionFile[],
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/:id/sessions/:sessionId/attachments/:attachmentId",
  requireAuth,
  requireRole("guidance_counselor", "nurse"),
  async (req, res, next) => {
    try {
      const result = await removeAttachment(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        String(req.params.attachmentId),
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
