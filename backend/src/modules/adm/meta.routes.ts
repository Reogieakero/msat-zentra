import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { coordinatorPhotoSchema, coordinatorProfileSchema } from "./adm.schemas.js";
import {
  listInvitableStaff,
  listPipeline,
  readCoordinatorProfileSettings,
  updateProfilePhoto,
  updateProfileSettings,
} from "../../services/adm/meta.service.js";

const router = Router();

router.get(
  "/pipeline",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (_req, res) => {
    res.json(await listPipeline());
  }
);

router.get(
  "/staff",
  requireAuth,
  requireRole("adm_coordinator"),
  async (req, res, next) => {
    try {
      const referralId =
        typeof req.query.referralId === "string" && req.query.referralId.trim()
          ? req.query.referralId.trim()
          : null;
      const profileId =
        typeof req.query.profileId === "string" && req.query.profileId.trim()
          ? req.query.profileId.trim()
          : null;
      res.json(await listInvitableStaff({ referralId, profileId }));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("adm_coordinator"),
  async (req, res, next) => {
    try {
      res.json(await readCoordinatorProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", coordinatorProfileSchema),
  async (req, res, next) => {
    try {
      const body = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        {
          fullName: body.fullName,
          primaryColor: body.primaryColor,
          secondaryColor: body.secondaryColor,
        },
      );
      await invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", coordinatorPhotoSchema),
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        photoUrl,
      );
      await invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
