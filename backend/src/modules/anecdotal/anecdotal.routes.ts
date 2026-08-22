import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";

const router = Router();

const createSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  observationDatetime: z.string().datetime(),
  descriptionOfIncident: z.string().min(1),
  descriptionOfLocation: z.string().optional(),
  notesRecommendationsActions: z.string().optional(),
  classPerformance: z.string().optional(),
  attendanceSummary: z.string().optional(),
  confidentialityLevel: z.enum(["restricted", "confidential"]).default("restricted"),
});
router.post(
  "/",
  requireAuth,
  requireRole("adviser"),
  validate("body", createSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.create({
        data: { ...req.body, observationDatetime: new Date(req.body.observationDatetime), observerId: req.user!.id },
      });
      await writeAudit({ userId: req.user!.id, actionType: "anecdotal_edit", sourceTable: "anecdotal_records", sourceId: record.id, reason: "Anecdotal record created" });
      res.status(201).json(record);
    } catch (e) { next(e); }
  }
);

const followupSchema = z.object({ notes: z.string().min(1) });
router.post(
  "/:id/followups",
  requireAuth,
  requireRole("adviser", "guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", followupSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const followup = await prisma.anecdotalRecordFollowup.create({
        data: { anecdotalRecordId: record.id, followupBy: req.user!.id, followupDate: new Date(), notes: req.body.notes },
      });
      await fanoutNotification({
        userId: record.observerId, sourceTable: "anecdotal_record_followups", action: "create",
        message: "New follow-up added to an anecdotal record.", sourceId: followup.id,
      });
      res.status(201).json(followup);
    } catch (e) { next(e); }
  }
);

const referSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
  reason: z.string().min(1),
  termId: z.string().min(1),
});
router.post(
  "/:id/refer",
  requireAuth,
  requireRole("adviser"),
  validate("body", referSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const referral = await prisma.referral.create({
        data: { anecdotalRecordId: record.id, referredToRole: req.body.referredToRole, referredBy: req.user!.id, reason: req.body.reason, studentId: record.studentId, termId: req.body.termId },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Referred to ${req.body.referredToRole}` });
      res.status(201).json(referral);
    } catch (e) { next(e); }
  }
);

export default router;
