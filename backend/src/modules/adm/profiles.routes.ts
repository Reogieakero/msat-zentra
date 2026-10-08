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

      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

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

      void invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"]);
    } catch (e) {
      next(e);
    }
  }
);

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
