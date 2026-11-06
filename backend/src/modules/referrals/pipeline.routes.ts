import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { REFERRAL_WRITE_TAGS } from "./referrals.repository.js";
import {
  adviserCancelSchema,
  dismissSchema,
  escalateSchema,
  followUpSchema,
  noteSchema,
  reassignSchema,
  reopenSchema,
  statusSchema,
} from "./referrals.schemas.js";
import {
  addNote,
  adviserCancel,
  deleteReferral,
  dismissReferral,
  escalate,
  reopenReferral,
  reassign,
  setFollowUp,
  updateStatus,
  type ReferralStatus,
} from "../../services/referrals/pipeline.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

router.post(
  "/:id/status",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", statusSchema),
  async (req, res, next) => {
    try {
      const { result, changed } = await updateStatus(ctxOf(req), String(req.params.id), {
        status: req.body.status as ReferralStatus,
        resolutionSummary: req.body.resolutionSummary as string | undefined,
      });
      if (changed) await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/escalate",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", escalateSchema),
  async (req, res, next) => {
    try {
      const updated = await escalate(ctxOf(req), String(req.params.id), {
        escalationReason: req.body.escalationReason as string,
        escalatedTo: req.body.escalatedTo as "principal" | "nurse" | "adm_coordinator",
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/reassign",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", reassignSchema),
  async (req, res, next) => {
    try {
      const updated = await reassign(
        ctxOf(req),
        String(req.params.id),
        req.body.referredToRole as "nurse" | "guidance_counselor" | "adm_coordinator" | "principal",
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/note",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", noteSchema),
  async (req, res, next) => {
    try {
      const updated = await addNote(ctxOf(req), String(req.params.id), req.body.notes as string);
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/follow-up",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", followUpSchema),
  async (req, res, next) => {
    try {
      const updated = await setFollowUp(
        ctxOf(req),
        String(req.params.id),
        req.body.followUpDate as string,
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/dismiss",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", dismissSchema),
  async (req, res, next) => {
    try {
      const updated = await dismissReferral(
        ctxOf(req),
        String(req.params.id),
        req.body.reason as string,
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/cancel",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", adviserCancelSchema),
  async (req, res, next) => {
    try {
      const updated = await adviserCancel(
        ctxOf(req),
        String(req.params.id),
        req.body.reason as string,
      );
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/reopen",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", reopenSchema),
  async (req, res, next) => {
    try {
      const updated = await reopenReferral(ctxOf(req), String(req.params.id), {
        referredToRole: req.body.referredToRole as
          | "nurse"
          | "guidance_counselor"
          | "adm_coordinator"
          | "principal"
          | undefined,
        consultReviewer: req.body.consultReviewer as
          | "nurse"
          | "guidance_counselor"
          | "lrpc"
          | undefined,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      await deleteReferral(ctxOf(req), String(req.params.id));
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
