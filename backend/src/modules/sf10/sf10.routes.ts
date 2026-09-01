import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { sf10Upload } from "../../lib/upload.js";
import { uploadFile, sf10ObjectPath } from "../../lib/storage.js";

const router = Router();

// Registrar = senior high (11–12), Record Keeper = junior high (7–10). These
// bands are fixed by PLAN.md §4.1 and must apply even when a staffProfile row
// is missing (e.g. seeded registrar has no handledGradeLevels). Advisers/teachers
// fall back to their staffProfile.handledGradeLevels when present.
const ROLE_GRADE_BAND: Record<string, string[]> = {
  registrar: ["G11", "G12"],
  record_keeper: ["G7", "G8", "G9", "G10"],
};

async function resolveGradeBand(role: string, userId: string): Promise<string[]> {
  if (ROLE_GRADE_BAND[role]) return ROLE_GRADE_BAND[role];
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { handledGradeLevels: true },
  });
  return staff?.handledGradeLevels ?? [];
}

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

// List SF10 records scoped to the caller's handled grade levels (registrar /
// record_keeper are banded 11–12 / 7–10 via staffProfile.handledGradeLevels).
router.get(
  "/records",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const band = await resolveGradeBand(req.user!.role, req.user!.id);
      const where =
        band.length > 0
          ? ({ student: { gradeLevel: { in: band } } } as Prisma.Sf10RecordWhereInput)
          : ({} as Prisma.Sf10RecordWhereInput);

      const records = await prisma.sf10Record.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          studentId: true,
          source: true,
          status: true,
          uploadedFileUrl: true,
          uploadedAt: true,
          verifiedBy: true,
          verifiedAt: true,
          validatedBy: true,
          validatedAt: true,
          releasedAt: true,
          archivedAt: true,
          currentVersion: true,
          updatedAt: true,
          student: {
            select: {
              lrn: true,
              user: { select: { fullName: true } },
              gradeLevel: true,
              section: { select: { name: true } },
            },
          },
          versions: {
            orderBy: { versionNumber: "asc" },
            select: {
              versionNumber: true,
              changedBy: true,
              changeReason: true,
              changedAt: true,
            },
          },
        },
      });

      res.json({
        records: records.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          lrn: r.student.lrn,
          fullName: r.student.user.fullName,
          gradeLevel: r.student.gradeLevel,
          section: r.student.section?.name ?? "—",
          source: r.source,
          status: r.status,
          uploadedFileUrl: r.uploadedFileUrl,
          uploadedAt: r.uploadedAt,
          verifiedBy: r.verifiedBy,
          verifiedAt: r.verifiedAt,
          validatedBy: r.validatedBy,
          validatedAt: r.validatedAt,
          releasedAt: r.releasedAt,
          archivedAt: r.archivedAt,
          currentVersion: r.currentVersion,
          updatedAt: r.updatedAt,
          versions: r.versions,
        })),
      });
    } catch (e) { next(e); }
  }
);

router.post(
  "/upload",
  requireAuth,
  requireRole("adviser", "registrar"),
  sf10Upload.single("file"),
  async (req, res, next) => {
    try {
      const studentId = String(req.body.studentId ?? "");
      if (!studentId) throw new AppError(400, "BAD_REQUEST", "studentId is required");
      if (!req.file) throw new AppError(400, "BAD_REQUEST", "SF10 file is required");

      const student = await prisma.studentProfile.findUnique({
        where: { userId: studentId },
        select: { userId: true, gradeLevel: true },
      });
      if (!student) throw new AppError(404, "NOT_FOUND", "Student not found");

      const isRegistrar = req.user!.role === "registrar";
      // Grade-band enforcement for registrar (11–12) / record_keeper (7–10).
      const band = await resolveGradeBand(req.user!.role, req.user!.id);
      if (band.length > 0 && !band.includes(student.gradeLevel)) {
        throw new AppError(403, "GRADE_SCOPE", "You do not handle this student's grade level");
      }

      const ext = req.file.originalname.split(".").pop() ?? "pdf";
      const path = sf10ObjectPath(studentId, ext);
      const fileUrl = await uploadFile(req.file.buffer, path, req.file.mimetype);

      const source = isRegistrar ? "manual" : "ocr_upload";
      const record = await prisma.sf10Record.upsert({
        where: { studentId },
        create: {
          studentId,
          source,
          status: "attach",
          uploadedFileUrl: fileUrl,
          uploadedAt: new Date(),
        },
        update: {
          source,
          uploadedFileUrl: fileUrl,
          uploadedAt: new Date(),
          status: "attach",
          verifiedBy: null,
          verifiedAt: null,
          validatedBy: null,
          validatedAt: null,
          releasedAt: null,
          archivedAt: null,
        },
      });

      // Append an initial version snapshot + audit entry.
      const existing = await prisma.sf10RecordVersion.count({
        where: { sf10RecordId: record.id },
      });
      await prisma.$transaction([
        prisma.sf10RecordVersion.create({
          data: {
            sf10RecordId: record.id,
            versionNumber: existing + 1,
            dataSnapshot: (record.ocrExtractedData as object) ?? {},
            changedBy: req.user!.id,
            changeReason: isRegistrar ? "Manual registrar upload" : "Initial OCR upload",
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            actionType: "sf10_update",
            sourceTable: "sf10_records",
            sourceId: record.id,
            reason: isRegistrar ? "SF10 uploaded by registrar" : "SF10 OCR upload",
          },
        }),
      ]);

      await invalidateTags(["registrar", "overview", "principal"]);
      res.status(201).json({ id: record.id, source: record.source, uploadedFileUrl: fileUrl });
    } catch (e) { next(e); }
  }
);

router.get(
  "/:id/versions",
  requireAuth,
  requireRole("principal", "registrar", "record_keeper"),
  async (req, res, next) => {
    try {
      const versions = await prisma.sf10RecordVersion.findMany({
        where: { sf10RecordId: String(req.params.id) },
        orderBy: { versionNumber: "asc" },
        select: {
          versionNumber: true,
          changedBy: true,
          changeReason: true,
          changedAt: true,
        },
      });
      res.json({ versions });
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

async function assertHandlesGrade(recordId: string, user: { id: string; role: string }) {
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
  const band = await resolveGradeBand(user.role, user.id);
  if (band.length > 0 && !band.includes(record.student.gradeLevel)) {
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
      await invalidateTags(["registrar", "overview", "principal"]);
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
      await invalidateTags(["registrar", "overview", "principal"]);
      res.json(updated[0]);
    } catch (e) { next(e); }
  }
);

export default router;
