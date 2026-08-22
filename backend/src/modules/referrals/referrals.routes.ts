import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";

const router = Router();

const statusSchema = z.object({ status: z.enum(["pending", "in_progress", "resolved"]) });
router.post(
  "/:id/status",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", statusSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === req.body.status) return res.json(referral);
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: req.body.status },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Status → ${req.body.status}`, oldValue: { status: referral.status }, newValue: { status: req.body.status } });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      const referrals = await prisma.referral.findMany({ include: { anecdotalRecord: true, student: true }, orderBy: { id: "asc" } });
      res.json(referrals);
    } catch (e) { next(e); }
  }
);

export default router;
