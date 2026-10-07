import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { guidancePhotoSchema, guidanceProfileSchema } from "./guidance.schemas.js";
import {
  readProfileSettings,
  updateProfilePhoto,
  updateProfileSettings,
} from "../../services/guidance/settings.service.js";

const router = Router();

// GET /api/guidance/settings/profile — own display name, photo, palette.
router.get(
  "/settings/profile",
  requireAuth,
  requireRole("guidance_counselor"),
  async (req, res, next) => {
    try {
      res.json(await readProfileSettings(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/guidance/settings/profile — display name + workspace palette.
router.patch(
  "/settings/profile",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", guidanceProfileSchema),
  async (req, res, next) => {
    try {
      const counselorId = req.user!.id;
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(
        { userId: counselorId, role: req.user!.role, termId: null, schoolYearId: null },
        { fullName, primaryColor, secondaryColor },
      );
      await invalidateTags(["guidance", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/guidance/settings/photo — profile photo upload (JSON data URL).
// PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
router.post(
  "/settings/photo",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", guidancePhotoSchema),
  async (req, res, next) => {
    try {
      const counselorId = req.user!.id;
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(
        { userId: counselorId, role: req.user!.role, termId: null, schoolYearId: null },
        photoUrl,
      );
      await invalidateTags(["guidance", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
