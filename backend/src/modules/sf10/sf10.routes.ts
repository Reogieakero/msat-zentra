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
        select: { student: { select: { gradeLevel: true } }, status: true },
      });

      const byGrade: Record<
        string,
        { attach: number; available: number; missing: number; released: number }
      > = {};
      for (const g of GRADE_ORDER) byGrade[g] = { attach: 0, available: 0, missing: 0, released: 0 };

      for (const r of records) {
        const g = r.student.gradeLevel;
        if (!byGrade[g]) byGrade[g] = { attach: 0, available: 0, missing: 0, released: 0 };
        byGrade[g][r.status] += 1;
      }

      // Students with no SF10 record at all are "missing" for their grade.
      const studentsWithoutRecord = await prisma.studentProfile.groupBy({
        by: ["gradeLevel"],
        where: { sf10Records: { none: {} } },
        _count: { _all: true },
      });
      for (const s of studentsWithoutRecord) {
        const g = s.gradeLevel;
        if (!byGrade[g]) byGrade[g] = { attach: 0, available: 0, missing: 0, released: 0 };
        byGrade[g].missing += s._count._all;
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
        create: { studentId: req.body.studentId, source: "ocr_upload", status: "attach", uploadedFileUrl: req.body.fileUrl },
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

async function assertHandlesGrade(recordId: string, user: { id: string }) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      status: true,
      verifiedBy: true,
      currentVersion: true,
      ocrExtractedData: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  const staff = await prisma.staffProfile.findUnique({
    where: { userId: user.id },
    select: { handledGradeLevels: true },
  });
  if (staff && staff.handledGradeLevels.length > 0 &&
      !staff.handledGradeLevels.includes(record.student.gradeLevel)) {
    throw new AppError(403, "GRADE_SCOPE", "You do not handle this student's grade level");
  }
  return record;
}

router.post(
  "/:id/validate",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const record = await assertHandlesGrade(String(req.params.id), req.user!);
      if (record.status !== "attach") throw new AppError(409, "BAD_STATUS", "Record must be in 'attach' status to validate");
      if (record.verifiedBy == null) throw new AppError(409, "NOT_VERIFIED", "Must be verified before validation");
      const updated = await prisma.$transaction([
        prisma.sf10Record.update({ where: { id: record.id }, data: { validatedBy: req.user!.id, validatedAt: new Date(), status: "available", currentVersion: { increment: 1 } } }),
        prisma.sf10RecordVersion.create({ data: { sf10RecordId: record.id, versionNumber: record.currentVersion + 1, dataSnapshot: (record.ocrExtractedData as object) ?? {}, changedBy: req.user!.id, changeReason: "Validation" } }),
        prisma.auditLog.create({ data: { userId: req.user!.id, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 validated" } }),
      ]);
      res.json(updated[0]);
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/release",
  requireAuth,
  requireRole("record_keeper", "registrar"),
  async (req, res, next) => {
    try {
      const record = await assertHandlesGrade(String(req.params.id), req.user!);
      if (record.status !== "available") throw new AppError(409, "BAD_STATUS", "Record must be 'available' before release");
      const now = new Date();
      const updated = await prisma.$transaction([
        prisma.sf10Record.update({
          where: { id: record.id },
          data: { status: "released", releasedAt: now, archivedAt: now },
        }),
        prisma.auditLog.create({ data: { userId: req.user!.id, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 released and archived" } }),
      ]);
      res.json(updated[0]);
    } catch (e) { next(e); }
  }
);

export default router;
