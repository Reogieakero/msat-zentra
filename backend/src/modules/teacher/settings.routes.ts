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

// Adviser section options for Settings ("Are you an adviser?"). Lists every
// section in the active school year with its holder, flagging which ones
// appear in the master teacher's schedule (committed timetable entries this
// term) so the picker can prefer schedule sections. Claimable = unclaimed;
// advisedByMe = already mine.
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

// Self-declared Master Teacher designation (grades 7–10 only). The grade
// band is re-resolved server-side from this term's assignments + advised
// sections, so a tampered client cannot claim it from grades 11–12.
// Turning it off is always allowed.
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

// Teacher profile settings (Settings page): display name, photo, and the
// workspace palette. Reads/writes the teacher's own User + StaffProfile rows
// (profile row upserted — teachers created before it existed have none).
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

// Profile photo upload (JSON data URL — same storage shape as the drawn
// signature). PNG/JPEG/GIF/WebP only, 2MB cap so rows stay lean.
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
