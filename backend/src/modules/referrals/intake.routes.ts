import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { REFERRAL_WRITE_TAGS } from "./referrals.repository.js";
import {
  acceptSchema,
  admSchema,
  nurseAcceptSchema,
  nurseAdmReviewSchema,
  nurseReferralFormSchema,
  specialistSchema,
} from "./referrals.schemas.js";
import {
  acceptGuidance,
  acceptNurse,
  forwardNurseAdm,
  initiateAdm,
  nurseAdmReview,
  referSpecialist,
  saveNurseReferralForm,
} from "../../services/referrals/intake.service.js";

const router = Router();

function ctxOf(req: { user?: { id: string; role: string }; termScope?: { termId: string } | null }) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
  };
}

router.post(
  "/:id/specialist",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", specialistSchema),
  async (req, res, next) => {
    try {
      const updated = await referSpecialist(
        ctxOf(req),
        String(req.params.id),
        req.body.referredToRole as "nurse" | "adm_coordinator" | "principal",
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
  "/:id/adm",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", admSchema),
  async (req, res, next) => {
    try {
      const updated = await initiateAdm(ctxOf(req), String(req.params.id), req.body.reason as string);
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Accept a case WITH intake: priority triage, first impressions, and an
// optional first counseling session booked on the spot.
router.post(
  "/:id/accept",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", acceptSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        priority: "low" | "normal" | "high";
        intakeNotes?: string;
        firstSession?: { scheduledAt: string; sessionType: string; venue?: string };
      };
      const updated = await acceptGuidance(ctxOf(req), String(req.params.id), {
        priority: body.priority,
        intakeNotes: body.intakeNotes,
        firstSession: body.firstSession,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Nurse intake: accept a case on the clinic's desk WITH first impressions
// and an optional first clinic session booked on the spot — one atomic
// call so a case is never half-accepted. Mirrors the guidance accept flow
// but scoped to the nurse's own queue (direct, escalated-to-nurse, or ADM
// consultation picked for the nurse).
router.post(
  "/:id/nurse-accept",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseAcceptSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        intakeNotes?: string;
        clinicSession?: { scheduledAt: string; venue?: string };
      };
      const result = await acceptNurse(ctxOf(req), String(req.params.id), {
        intakeNotes: body.intakeNotes,
        clinicSession: body.clinicSession,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// Nurse consultation review on an ADM-purpose referral sitting at the
// consultation stage with no learner profile yet. Mirrors the guidance
// consultation review, but only the nurse may decide cases picked for the
// nurse (consultReviewer === "nurse"):
//   - endorse: consultation done, case moves to in_progress for the ADM
//     coordinator's parent meeting (the "create referral forward").
//   - reject: the filing doesn't warrant ADM, case closes as dismissed.
router.post(
  "/:id/nurse-adm-review",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseAdmReviewSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        recommendation: string;
        outcome: "endorse" | "reject";
        clinicSession?: { scheduledAt?: unknown; venue?: unknown };
        referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown };
      };
      const updated = await nurseAdmReview(ctxOf(req), String(req.params.id), {
        recommendation: body.recommendation,
        outcome: body.outcome,
        clinicSession: body.clinicSession,
        referralForm: body.referralForm,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

// Save the nurse's referral form (GCForm-03 fill-up) on an ADM consultation
// case. Confirming the form writes one endorse-style internal note and sets
// referralFormReady — the UI forwards (endorses) to the ADM coordinator
// right away, so the note reads as the endorsement. The nurse's
// recommendation is NOT copied to intakeNotes, so ADM cards never show a
// "First impressions" line. Re-saving while pending refreshes the answers.
router.post(
  "/:id/nurse-referral-form",
  requireAuth,
  requireRole("nurse"),
  validate("body", nurseReferralFormSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        recommendation: string;
        referralForm?: { concerns?: unknown; detailsOfConcern?: unknown; nurseActions?: unknown; followUp?: unknown };
        clinicSession?: { scheduledAt?: unknown; venue?: unknown };
      };
      const updated = await saveNurseReferralForm(ctxOf(req), String(req.params.id), {
        recommendation: body.recommendation,
        referralForm: body.referralForm,
        clinicSession: body.clinicSession,
      });
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
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
      const updated = await forwardNurseAdm(ctxOf(req), String(req.params.id));
      await invalidateTags(REFERRAL_WRITE_TAGS);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
