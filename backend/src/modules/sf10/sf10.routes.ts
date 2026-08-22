import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";

const router = Router();

const uploadSchema = z.object({ studentId: z.string().min(1), fileUrl: z.string().url() });
router.post(
  "/upload",
  requireAuth,
  requireRole("adviser"),
  validate("body", uploadSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.sf10Record.upsert({
        where: { studentId: req.body.studentId },
        create: { studentId: req.body.studentId, source: "ocr_upload", uploadedFileUrl: req.body.fileUrl },
        update: { source: "ocr_upload", uploadedFileUrl: req.body.fileUrl },
      });
      // OCR job enqueue is external (OCR_WORKER_URL); here we just acknowledge.
      res.status(201).json({ id: record.id, source: record.source });
    } catch (e) { next(e); }
  }
);

router.get(
  "/ocr/:jobId",
  requireAuth,
  requireRole("adviser"),
  async (req, res, next) => {
    try {
      const record = await prisma.sf10Record.findUnique({ where: { id: String(req.params.jobId) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
      res.json({ id: record.id, ocrExtractedData: record.ocrExtractedData, source: record.source });
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/verify",
  requireAuth,
  requireRole("subject_teacher", "adviser"),
  async (req, res, next) => {
    try {
      const record = await prisma.sf10Record.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
      const updated = await prisma.sf10Record.update({ where: { id: record.id }, data: { verifiedBy: req.user!.id, verifiedAt: new Date() } });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/validate",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const record = await prisma.sf10Record.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
      if (record.verifiedBy == null) throw new AppError(409, "NOT_VERIFIED", "Must be verified before validation");
      const updated = await prisma.$transaction([
        prisma.sf10Record.update({ where: { id: record.id }, data: { validatedBy: req.user!.id, validatedAt: new Date(), currentVersion: { increment: 1 } } }),
        prisma.sf10RecordVersion.create({ data: { sf10RecordId: record.id, versionNumber: record.currentVersion + 1, dataSnapshot: (record.ocrExtractedData as object) ?? {}, changedBy: req.user!.id, changeReason: "Validation" } }),
        prisma.auditLog.create({ data: { userId: req.user!.id, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 validated" } }),
      ]);
      res.json(updated[0]);
    } catch (e) { next(e); }
  }
);

export default router;
