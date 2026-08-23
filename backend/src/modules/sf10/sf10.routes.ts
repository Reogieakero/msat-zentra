import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";

const router = Router();

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"] as const;
const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

router.get(
  "/summary",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const records = await prisma.sf10Record.findMany({
        select: {
          student: { select: { gradeLevel: true } },
          uploadedFileUrl: true,
          verifiedAt: true,
          validatedAt: true,
        },
      });

      const byGrade: Record<
        string,
        { attached: number; available: number; missing: number }
      > = {};
      for (const g of GRADE_ORDER) byGrade[g] = { attached: 0, available: 0, missing: 0 };

      for (const r of records) {
        const g = r.student.gradeLevel;
        if (!byGrade[g]) byGrade[g] = { attached: 0, available: 0, missing: 0 };
        if (r.validatedAt) byGrade[g].attached += 1;
        else if (r.uploadedFileUrl || r.verifiedAt) byGrade[g].available += 1;
        else byGrade[g].missing += 1;
      }

      const levels = GRADE_ORDER.map((g) => ({ grade: GRADE_LABEL[g], ...byGrade[g] }));
      res.json({ levels });
    } catch (e) { next(e); }
  }
);

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
