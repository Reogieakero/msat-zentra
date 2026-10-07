import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";import { validate } from "../../middleware/validate.js";
import type { AdmStage } from "../../services/adm.js";
import {
  advanceSchema,
  certificationSchema,
  profileSchema,
} from "./adm.schemas.js";
import {
  advanceStage,
  certify,
  createProfile,
  getCaseFile,
  principalApprove,
  principalReturn,
} from "../../services/adm/profiles.service.js";

const router = Router();

router.post(
  "/profiles",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", profileSchema),
  async (req, res, next) => {
    try {
      const profileTermId = req.termScope?.termId ?? (req.body.termId as string);
      const { profile, provisioned } = await createProfile(
        { userId: req.user!.id, role: req.user!.role, termId: profileTermId },
        {
          studentId: req.body.studentId as string | undefined,
          referralId: req.body.referralId as string,
          termId: profileTermId,
          certificationDetails: req.body.certificationDetails as Record<string, unknown> | undefined,
        },
      );
      res.status(201).json(provisioned ? { ...profile, provisioned: true } : profile);
      // Cache purges are non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
      if (provisioned) {
        void invalidateTags(["registrar", "record-keeper"]);
      }
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/principal-approve",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const updated = await principalApprove(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
      );
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/principal-return",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const updated = await principalReturn(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
      );
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/:id/stage",
  requireAuth,
  validate("body", advanceSchema),
  async (req, res, next) => {
    try {
      const updated = await advanceStage(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
        req.body.stage as AdmStage,
      );
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

// The ADM Coordinator's recommendation + certification, filled up right
// after the parent meeting is attended: records the recommendation and
// passes the case straight to the Principal for signature in one click.
// Accepts any pre-certification stage — early referral bookings often
// leave the stage column lagging behind the attended meeting — but always
// requires an attended parent meeting (no home-visitation path needed).
// Eligibility recomputes from the evidence chain exactly like the stage
// route, so the principal gate always reads a computed value.
router.post(
  "/:id/certification",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", certificationSchema),
  async (req, res, next) => {
    try {
      const updated = await certify(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
        req.body.recommendation as string,
      );
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

// Dedicated case file for the coordinator's "Open case" new-tab page.
// Accepts either a learner-profile id or a `referral:<id>` row id (early
// referrals without a profile yet). Returns the student header, the
// adviser's anecdotal write-up + recommendations, the GCForm-03 referral
// form state, the ADM evidence chain (forms), and parent meetings —
// everything the new-tab page renders without extra round-trips.
router.get(
  "/case/:id",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm", "adm-case", "adm-referrals"] }),
  async (req, res, next) => {
    try {
      res.json(await getCaseFile(String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
