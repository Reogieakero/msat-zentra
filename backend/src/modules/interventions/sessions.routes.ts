import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { INTERVENTION_WRITE_TAGS } from "./interventions.repository.js";
import {
  cancelInterventionSessionSchema,
  completeInterventionSessionSchema,
  interventionSessionSchema,
  rescheduleInterventionSessionSchema,
} from "./interventions.schemas.js";
import {
  addAttachments,
  bookSession,
  cancelSession,
  completeSession,
  listAttachments,
  listSessions,
  removeAttachment,
  rescheduleSession,
  type SessionFile,
} from "../../services/interventions/sessions.service.js";

const router = Router();

// Session documentary uploads — same rules as the clinic desk: images only,
// 5 MB each, max 5 per request. Filing never gates Done; it only builds the
// evidence trail for sessions that already started (or are finished).
const sessionDocsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP images are allowed for session documentation."));
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

router.post(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", interventionSessionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as { scheduledAt: string; sessionType: string; venue?: string };
      const created = await bookSession(ctxOf(req), String(req.params.id), {
        scheduledAt: body.scheduledAt,
        sessionType: body.sessionType,
        venue: body.venue,
      });
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/complete",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", completeInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        sessionNotes: string;
        outcome?: string;
        followUpSession?: { scheduledAt: string; sessionType: string; venue?: string };
      };
      const updated = await completeSession(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        {
          sessionNotes: body.sessionNotes,
          outcome: body.outcome,
          followUpSession: body.followUpSession,
        },
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/reschedule",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", rescheduleInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const updated = await rescheduleSession(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        req.body.scheduledAt as string,
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/sessions/:sessionId/cancel",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", cancelInterventionSessionSchema),
  async (req, res, next) => {
    try {
      const updated = await cancelSession(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        (req.body as { cancelReason?: string }).cancelReason,
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Session documentary: list / upload / remove image attachments on one
// counseling session. Filing is optional — these endpoints never gate Done,
// they only build the evidence trail. Uploads are allowed on open cases (any
// session status except a closed follow-up) so documentation can be filed
// after marking a session done — but a still-upcoming session unlocks only
// once its scheduled time arrives.
router.get(
  "/:id/sessions/:sessionId/attachments",
  requireAuth,
  requireRole("guidance_counselor", "principal"),
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
  requireRole("guidance_counselor"),
  sessionDocsUpload.array("files", 5),
  async (req, res, next) => {
    try {
      const files = ((req as unknown as { files?: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }> }).files ?? []);
      const created = await addAttachments(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        files as SessionFile[],
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

// Session list for one follow-up — powers the booking-reminder liveness
// check (card drops only while a scheduled session still exists).
router.get(
  "/:id/sessions",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      res.json(await listSessions(ctxOf(req), String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/:id/sessions/:sessionId/attachments/:attachmentId",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      const result = await removeAttachment(
        ctxOf(req),
        String(req.params.id),
        String(req.params.sessionId),
        String(req.params.attachmentId),
      );
      await invalidateTags(INTERVENTION_WRITE_TAGS);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
