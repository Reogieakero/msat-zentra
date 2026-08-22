import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";

const router = Router();

router.get(
  "/referrals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      const profiles = await prisma.admLearnerProfile.findMany({
        include: { student: true, referral: true },
        orderBy: { id: "asc" },
      });
      // Principal: status-only — strip confidential fields
      const out = profiles.map((p) =>
        req.user!.role === "principal"
          ? { id: p.id, studentId: p.studentId, eligibilityStatus: p.eligibilityStatus, approvedBy: p.approvedBy, approvedAt: p.approvedAt }
          : p
      );
      res.json(out);
    } catch (e) { next(e); }
  }
);

const profileSchema = z.object({
  studentId: z.string().min(1),
  referralId: z.string().min(1),
  termId: z.string().min(1),
  certificationDetails: z.record(z.any()).optional(),
});
router.post(
  "/profiles",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", profileSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: req.body.referralId } });
      if (!referral) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral required for ADM profile");
      const profile = await prisma.admLearnerProfile.create({
        data: { ...req.body, preparedBy: req.user!.id },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: "ADM learner profile created" });
      await fanoutNotification({ userId: req.user!.id, sourceTable: "adm_learner_profiles", action: "certify", message: "ADM profile ready for principal signature.", sourceId: profile.id });
      res.status(201).json(profile);
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/principal-approve",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({ where: { id: String(req.params.id) } });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      if (profile.approvedBy) throw new AppError(409, "ALREADY_APPROVED", "Already signed by principal");
      const updated = await prisma.admLearnerProfile.update({
        where: { id: profile.id },
        data: { approvedBy: req.user!.id, approvedAt: new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: "Principal final signature", oldValue: { approvedBy: null }, newValue: { approvedBy: req.user!.id } });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const deviceIssueSchema = z.object({
  admLearnerProfileId: z.string().min(1),
  deviceType: z.string().min(1),
  deviceSerial: z.string().min(1),
  issuedDate: z.string().datetime().optional(),
  conditionNotes: z.string().optional(),
});
router.post(
  "/devices/issue",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceIssueSchema),
  async (req, res, next) => {
    try {
      const device = await prisma.admDevice.create({
        data: { ...req.body, issuedBy: req.user!.id, issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device issued" });
      res.status(201).json(device);
    } catch (e) { next(e); }
  }
);

const deviceReturnSchema = z.object({ returnedDate: z.string().datetime().optional() });
router.post(
  "/devices/:id/return",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceReturnSchema),
  async (req, res, next) => {
    try {
      const device = await prisma.admDevice.findUnique({ where: { id: String(req.params.id) } });
      if (!device) throw new AppError(404, "NOT_FOUND", "Device not found");
      if (device.returnedDate) throw new AppError(409, "ALREADY_RETURNED", "Device already returned");
      const updated = await prisma.admDevice.update({ where: { id: device.id }, data: { returnedDate: req.body.returnedDate ? new Date(req.body.returnedDate) : new Date() } });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device returned" });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

export default router;
