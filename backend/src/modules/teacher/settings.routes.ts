import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { resolveActiveTermId } from "../../services/risk.js";
import {
  masterTeacherSchema,
  teacherPhotoSchema,
  teacherProfileSchema,
} from "./teacher.schemas.js";
import {
  listAdviserSections,
  readProfileSettings,
  setMasterTeacher,
  updateProfilePhoto,
  updateProfileSettings,
} from "../../services/teacher/settings.service.js";

const router = Router();

function ctxOf(req: {
  user?: { id: string; role: string };
  termScope?: { termId: string; schoolYearId: string } | null;
}) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    termId: req.termScope?.termId ?? null,
    schoolYearId: req.termScope?.schoolYearId ?? null,
  };
}

router.get(
  "/settings/adviser-sections",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const termId = await resolveActiveTermId(req);
      res.json(
        await listAdviserSections({
          ...ctxOf(req),
          termId,
        }),
      );
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/settings/master-teacher",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", masterTeacherSchema),
  async (req, res, next) => {
    try {
      const { isMasterTeacher } = req.body as { isMasterTeacher: boolean };
      const termId = await resolveActiveTermId(req);
      const result = await setMasterTeacher({ ...ctxOf(req), termId }, isMasterTeacher);
      await invalidateTags(["teacher", "overview", "schedule", "academics", "principal"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/settings/profile",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
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
  requireRole("subject_teacher", "adviser"),
  validate("body", teacherProfileSchema),
  async (req, res, next) => {
    try {
      const { fullName, primaryColor, secondaryColor } = req.body as {
        fullName?: string;
        primaryColor?: string | null;
        secondaryColor?: string | null;
      };
      const result = await updateProfileSettings(ctxOf(req), {
        fullName,
        primaryColor,
        secondaryColor,
      });
      await invalidateTags(["teacher", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/settings/photo",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  validate("body", teacherPhotoSchema),
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body as { photoUrl: string };
      const result = await updateProfilePhoto(ctxOf(req), photoUrl);
      await invalidateTags(["teacher", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
