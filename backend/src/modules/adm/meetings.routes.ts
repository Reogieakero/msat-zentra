import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import {
  meetingBookSchema,
  meetingOutcomeSchema,
  meetingRescheduleSchema,
} from "./adm.schemas.js";
import {
  addAttachments,
  bookProfileMeeting,
  bookReferralMeeting,
  listProfileMeetings,
  recordOutcome,
  removeAttachment,
  rescheduleMeeting,
  type MeetingFile,
} from "../../services/adm/meetings.service.js";

const router = Router();

// Meeting documentation uploads: photos filed on a parent meeting (signed
// logbook, venue, agreements…). Images only, 5 MB each, max 5 per request,
// 10 per meeting — mirrors the clinic session documentation flow.
const meetingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP images are allowed for meeting documentation."));
    }
  },
});

const ADM_TAG_GROUP = ["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview", "principal"];

// Parent/guardian meetings booked by the coordinator once a case is
// referred to ADM — in school ("school") or at home ("home", home
// visitation). Booking is allowed for any unsigned profile at a
// pre-certification stage; recording the outcome later drives the
// meeting_parents → certification | home_visitation branch.
router.post(
  "/:id/meetings",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingBookSchema),
  async (req, res, next) => {
    try {
      const meeting = await bookProfileMeeting(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.id),
        {
          meetingDatetime: req.body.meetingDatetime as string,
          venue: req.body.venue as string,
          minutesOfMeeting: req.body.minutesOfMeeting as string | undefined,
          attendanceLogbookRef: req.body.attendanceLogbookRef as string | undefined,
          inviteeIds: req.body.inviteeIds as string[] | undefined,
        },
      );
      await invalidateTags(ADM_TAG_GROUP);
      res.status(201).json(meeting);
    } catch (e) {
      next(e);
    }
  }
);

// Pre-profile booking: schedule the parent meeting directly on a referral.
// Needs NO student account and NO learner profile — roster enlistments work.
// If a profile already exists for the referral, the meeting lands on it;
// otherwise it attaches to the referral and transfers on profile creation.
router.post(
  "/referral/:referralId/meetings",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingBookSchema),
  async (req, res, next) => {
    try {
      const meeting = await bookReferralMeeting(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.referralId),
        {
          meetingDatetime: req.body.meetingDatetime as string,
          venue: req.body.venue as string,
          minutesOfMeeting: req.body.minutesOfMeeting as string | undefined,
          attendanceLogbookRef: req.body.attendanceLogbookRef as string | undefined,
          inviteeIds: req.body.inviteeIds as string[] | undefined,
        },
      );
      await invalidateTags(ADM_TAG_GROUP);
      res.status(201).json(meeting);
    } catch (e) {
      next(e);
    }
  }
);

// Reschedule a still-booked (unattended) parent meeting — new date/time
// and/or venue. Attended meetings keep their history and cannot move; book
// a fresh meeting instead. Locked (certified/signed) cases reject too.
router.patch(
  "/meetings/:meetingId/reschedule",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingRescheduleSchema),
  async (req, res, next) => {
    try {
      const updated = await rescheduleMeeting(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.meetingId),
        {
          meetingDatetime: req.body.meetingDatetime as string,
          venue: req.body.venue as string,
          attendanceLogbookRef: req.body.attendanceLogbookRef as string | undefined,
          inviteeIds: req.body.inviteeIds as string[] | undefined,
        },
      );
      await invalidateTags(ADM_TAG_GROUP);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/meetings/:meetingId/attachments",
  requireAuth,
  requireRole("adm_coordinator"),
  meetingUpload.array("files", 5),
  async (req, res, next) => {
    try {
      const files = (
        req as unknown as {
          files?: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>;
        }
      ).files ?? [];
      const created = await addAttachments(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.meetingId),
        files as MeetingFile[],
      );
      await invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview"]);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/meetings/:meetingId/attachments/:attachmentId",
  requireAuth,
  requireRole("adm_coordinator"),
  async (req, res, next) => {
    try {
      const result = await removeAttachment(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.meetingId),
        String(req.params.attachmentId),
      );
      await invalidateTags(["adm", "adm-overview", "adm-referrals", "adm-meetings", "adm-certifications", "adm-approvals", "adm-devices", "adm-case", "overview"]);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/:id/meetings",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm", "adm-meetings", "adm-case"] }),
  async (req, res, next) => {
    try {
      res.json(await listProfileMeetings(String(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/meetings/:meetingId",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingOutcomeSchema),
  async (req, res, next) => {
    try {
      const updated = await recordOutcome(
        { userId: req.user!.id, role: req.user!.role, termId: req.termScope?.termId ?? null },
        String(req.params.meetingId),
        {
          attended: req.body.attended as boolean,
          minutesOfMeeting: req.body.minutesOfMeeting as string | undefined,
          attendanceLogbookRef: req.body.attendanceLogbookRef as string | undefined,
          parentConfirmedAt: req.body.parentConfirmedAt as string | undefined,
          attendees: req.body.attendees as { name: string; role: string; userId?: string }[] | undefined,
        },
      );
      await invalidateTags(ADM_TAG_GROUP);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
