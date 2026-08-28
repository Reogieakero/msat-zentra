import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { ADM_STAGE_FLOW, ADM_STAGES } from "../../services/adm.js";

const router = Router();

router.get(
  "/pipeline",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (_req, res) => {
    res.json({ stages: ADM_STAGES, flow: ADM_STAGE_FLOW });
  }
);


router.get(
  "/dashboard",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (_req, res, next) => {
    try {
      const profiles = await prisma.admLearnerProfile.findMany({
        include: {
          student: { include: { user: true } },
          preparedByUser: true,
          forms: { orderBy: { uploadedAt: "desc" } },
        },
        orderBy: { id: "desc" },
      });

      const deriveStage = (p: {
        approvedBy: string | null;
        eligibilityStatus: string;
      }): string => {
        if (p.approvedBy) return "principal_approval";
        if (p.eligibilityStatus === "eligible") return "eligibility";
        return "referred";
      };

      const stageBreakdown = ADM_STAGE_FLOW.map((s) => ({
        stage: s.stage,
        short: s.label,
        count: profiles.filter((p) => deriveStage(p) === s.stage).length,
      }));

      const pendingSignature = profiles.filter(
        (p) => !p.approvedBy && p.eligibilityStatus === "eligible"
      ).length;
      const signed = profiles.filter((p) => p.approvedBy).length;

      const latestReferred = profiles
        .filter((p) => ["referred", "eligibility", "principal_approval"].includes(deriveStage(p)))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: p.student.gradeLevel,
          stage: deriveStage(p) as "referred" | "eligibility" | "principal_approval",
          eligibilityStatus: p.eligibilityStatus,
          preparedBy: p.preparedByUser.fullName,
          approvedBy: p.approvedBy,
          forms: p.forms.map((f) => ({
            id: f.id,
            formType: f.formType,
            title: f.title,
            status: f.status,
            uploadedAt: f.uploadedAt,
          })),
        }));

      res.json({
        kpis: { pendingSignature, signed, active: profiles.length },
        stageBreakdown,
        latestReferred,
      });
    } catch (e) {
      next(e);
    }
  }
);

const GRADE_LABEL: Record<string, string> = {
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

const ELIGIBILITY_LABEL: Record<string, string> = {
  pending: "For Review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

router.get(
  "/referrals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      const profiles = await prisma.admLearnerProfile.findMany({
        include: {
          student: { include: { user: true } },
          preparedByUser: true,
        },
        orderBy: { id: "asc" },
      });
      const out = profiles.map((p) => {
        const signed = !!p.approvedBy;
        const base = {
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
          status: signed ? "signed" : "pending_signature",
          eligibility: ELIGIBILITY_LABEL[p.eligibilityStatus] ?? p.eligibilityStatus,
          preparedBy: p.preparedByUser.fullName,
        };
        // Principal: status-only — strip confidential fields
        return req.user!.role === "principal" ? base : { ...base, studentId: p.studentId };
      });
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
