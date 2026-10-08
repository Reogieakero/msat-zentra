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
