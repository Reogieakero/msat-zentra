import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { uploadFile, sf10ObjectPath, getSf10Bucket } from "../../lib/storage.js";
import {
  GRADE_LABEL,
  GRADE_ORDER,
  assertHandlesGrade,
  resolveGradeBand,
} from "../../modules/sf10/sf10.repository.js";
import type { Sf10Context } from "./sf10.types.js";

export async function getSummary() {
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

  // Students with no SF10 record at all are "missing" for their grade —
  // enlisted students without accounts included (they hold no SF10 yet).
  const [studentsWithoutRecord, rosterLrns, profileLrns] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["gradeLevel"],
      where: { sf10Records: { none: {} } },
      _count: { _all: true },
    }),
    prisma.studentRoster.findMany({ select: { lrn: true, gradeLevel: true } }),
    prisma.studentProfile.findMany({ select: { lrn: true } }),
  ]);
  for (const s of studentsWithoutRecord) {
    const g = s.gradeLevel;
    if (!byGrade[g]) byGrade[g] = { attach: 0, available: 0, missing: 0, released: 0 };
    byGrade[g].missing += s._count._all;
  }
  const registeredLrns = new Set(profileLrns.map((p) => p.lrn));
  for (const r of rosterLrns) {
    if (registeredLrns.has(r.lrn)) continue;
    if (!byGrade[r.gradeLevel]) byGrade[r.gradeLevel] = { attach: 0, available: 0, missing: 0, released: 0 };
    byGrade[r.gradeLevel].missing += 1;
  }

  const levels = GRADE_ORDER.map((g) => ({ grade: GRADE_LABEL[g], ...byGrade[g] }));
  return { levels };
}

export interface RecordsQuery {
  band: string[];
  page: number;
  pageSize: number;
  q: string;
  status: "attach" | "available" | "released" | null;
}

// List SF10 records scoped to the caller's handled grade levels (registrar /
// record_keeper are banded 11–12 / 7–10 via staffProfile.handledGradeLevels).
export async function listRecords(query: RecordsQuery) {
  const { band, page, pageSize, q, status } = query;
  const bandWhere =
    band.length > 0
      ? ({ student: { gradeLevel: { in: band } } } as Prisma.Sf10RecordWhereInput)
      : ({} as Prisma.Sf10RecordWhereInput);

  // Server paging + search (list standard): `total` drives the pager
  // (filtered count); `counts` stay global (unfiltered) for the tiles.
  const where: Prisma.Sf10RecordWhereInput = {
    ...bandWhere,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { student: { user: { fullName: { contains: q, mode: "insensitive" } } } },
            { student: { lrn: { contains: q, mode: "insensitive" } } },
            { student: { section: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [total, counts, records] = await Promise.all([
    prisma.sf10Record.count({ where }),
    prisma.sf10Record.groupBy({
      by: ["status"],
      where: bandWhere,
      _count: { _all: true },
    }),
    prisma.sf10Record.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
      },
    }),
  ]);
  const countBy = { attach: 0, available: 0, released: 0 };
  for (const c of counts) countBy[c.status] = c._count._all;

  return {
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
    })),
    total,
    page,
    pageSize,
    counts: { ...countBy, total: countBy.attach + countBy.available + countBy.released },
  };
}

export interface UploadInput {
  studentId: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

export async function uploadRecord(ctx: Sf10Context, input: UploadInput) {
  const { studentId, file } = input;
  if (!studentId) throw new AppError(400, "BAD_REQUEST", "studentId is required");

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: { userId: true, gradeLevel: true },
  });
  if (!student) throw new AppError(404, "NOT_FOUND", "Student not found");

  const isRegistrar = ctx.role === "registrar";
  // Grade-band enforcement for registrar (11–12) / record_keeper (7–10).
  const band = await resolveGradeBand(ctx.role, ctx.userId);
  if (band.length > 0 && !band.includes(student.gradeLevel)) {
    throw new AppError(403, "GRADE_SCOPE", "You do not handle this student's grade level");
  }

  const ext = file.originalname.split(".").pop() ?? "pdf";
  const path = sf10ObjectPath(studentId, ext);
  const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getSf10Bucket());

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
        changedBy: ctx.userId,
        changeReason: isRegistrar ? "Manual registrar upload" : "Initial OCR upload",
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        actionType: "sf10_update",
        sourceTable: "sf10_records",
        sourceId: record.id,
        reason: isRegistrar ? "SF10 uploaded by registrar" : "SF10 OCR upload",
      },
    }),
  ]);

  return { id: record.id, source: record.source, uploadedFileUrl: fileUrl };
}

export async function listVersions(recordId: string) {
  const versions = await prisma.sf10RecordVersion.findMany({
    where: { sf10RecordId: recordId },
    orderBy: { versionNumber: "asc" },
    select: {
      versionNumber: true,
      changedBy: true,
      changeReason: true,
      changedAt: true,
    },
  });
  return { versions };
}

export async function getOcrResult(recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: { id: true, ocrExtractedData: true, source: true },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  return { id: record.id, ocrExtractedData: record.ocrExtractedData, source: record.source };
}

export async function verifyRecord(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: { id: true },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  const updated = await prisma.sf10Record.update({ where: { id: record.id }, data: { verifiedBy: ctx.userId, verifiedAt: new Date() } });
  // Registrar desk handoff (best-effort): a verified record needs band
  // validation. Names the learner + section so the toast reads specific.
  void (async () => {
    try {
      const full = await prisma.sf10Record.findUnique({
        where: { id: record.id },
        select: {
          student: {
            select: {
              gradeLevel: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
        },
      });
      const gradeLevel = full?.student.gradeLevel ?? null;
      const bandRole =
        gradeLevel === "G7" || gradeLevel === "G8" || gradeLevel === "G9" || gradeLevel === "G10"
          ? "record_keeper"
          : "registrar";
      const name = full?.student.user.fullName ?? "A student";
      const section = full?.student.section?.name ?? "—";
      await fanoutToRole(bandRole, {
        sourceTable: "sf10_records",
        action: "verified",
        message: `SF10 verified: ${name} (${section}) — needs validation.`,
        sourceId: record.id,
        excludeUserId: ctx.userId,
      });
    } catch {
      // Best-effort only — verification already succeeded.
    }
  })();
  return updated;
}

export async function validateRecord(ctx: Sf10Context, recordId: string) {
  const record = await assertHandlesGrade(recordId, ctx);
  if (record.status !== "attach") throw new AppError(409, "BAD_STATUS", "Record must be in 'attach' status to validate");
  if (record.verifiedBy == null) throw new AppError(409, "NOT_VERIFIED", "Must be verified before validation");
  const updated = await prisma.$transaction([
    prisma.sf10Record.update({ where: { id: record.id }, data: { validatedBy: ctx.userId, validatedAt: new Date(), status: "available", currentVersion: { increment: 1 } } }),
    prisma.sf10RecordVersion.create({ data: { sf10RecordId: record.id, versionNumber: record.currentVersion + 1, dataSnapshot: (record.ocrExtractedData as object) ?? {}, changedBy: ctx.userId, changeReason: "Validation" } }),
    prisma.auditLog.create({ data: { userId: ctx.userId, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 validated" } }),
  ]);
  // Own-bell receipt so the actor's badge bumps live (echo toast
  // suppressed client-side).
  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "sf10_records",
    action: "validate_self",
    message: `You validated an SF10 record — now available.`,
    sourceId: record.id,
  });
  return updated[0];
}

export async function releaseRecord(ctx: Sf10Context, recordId: string) {
  const record = await assertHandlesGrade(recordId, ctx);
  if (record.status !== "available") throw new AppError(409, "BAD_STATUS", "Record must be 'available' before release");
  const now = new Date();
  const updated = await prisma.$transaction([
    prisma.sf10Record.update({
      where: { id: record.id },
      data: { status: "released", releasedAt: now, archivedAt: now },
    }),
    prisma.auditLog.create({ data: { userId: ctx.userId, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 released and archived" } }),
  ]);
  // Own-bell receipt so the actor's badge bumps live (echo toast
  // suppressed client-side).
  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "sf10_records",
    action: "release_self",
    message: `You released an SF10 record — archived.`,
    sourceId: record.id,
  });
  return updated[0];
}
