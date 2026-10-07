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

// Staff directory for parent-meeting invites — active guidance counselors,
// nurses, and advisers the coordinator can invite by name.
// Status-only directory: id, name, role. No student data.
// The adviser group is scoped to the case: pass referralId (pre-profile) or
// profileId and only that student's section adviser is listed — the whole
// adviser roster never crowds the picker. Without a case context, all active
// advisers are returned (fallback).
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

// GET /api/adm/settings/profile — own display name, photo, palette.
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

// PATCH /api/adm/settings/profile — display name + workspace palette.
// Mirrors the nurse/guidance endpoints; adviser / master-teacher fields are
// intentionally absent for the coordinator desk.
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

// POST /api/adm/settings/photo — profile photo upload (JSON data URL).
// PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
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
