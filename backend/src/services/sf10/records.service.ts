import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/pino.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { uploadFile, sf10ObjectPath, getSf10Bucket } from "../../lib/storage.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedProfiles,
  excludeArchivedRosters,
} from "../../lib/learnerVisibility.js";
import { getEnv } from "../../config/env.js";
import {
  extractPdfText,
  extractSubjectsFromGrid,
  extractSubjectsFromGridShs,
  extractXlsxGrid,
  isShsForm,
  isXlsxUpload,
  tryWorker,
} from "./ocr-text.service.js";
import { isImageUpload, ocrFileToSubjects, pdfHasImages } from "./ocr-image.service.js";

// Photo OCR budget per file (tesseract WASM, background or slow requests).
const OCR_TIMEOUT_MS = 180_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
import {
  extractIdentityFromCells,
  extractIdentityFromText,
  formatLearnerName,
  type LearnerIdentity,
} from "./learner-identity.service.js";
import { detectGradeLevelFromText, maxGradeLevel, parseClassifiedGrade } from "./subject-aliases.js";
import { matchLearnerCandidates } from "./learner-match.service.js";
import { buildDeficiencyMap, buildSubjectMap } from "./subject-map.service.js";
import {
  GRADE_LABEL,
  GRADE_ORDER,
  assertAdviserSf10Access,
  assertDeskAccess,
  assertRecordAccess,
  resolveGradeBand,
} from "../../modules/sf10/sf10.repository.js";
import { canUploadGradeLevel, deskForRole, deskForUpload, provisionGradeForUpload } from "../../lib/roles.js";
import { mascotFor } from "../mascot.js";
import type { Sf10Context } from "./sf10.types.js";
import {
  renderAutoFillFile,
  type OriginalSf10File,
} from "./generated-file.service.js";

const SF10_PDF_MIME = "application/pdf";
const SF10_XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Fetch the registrar/record-keeper upload so auto-fill can derive a new file
 * in the same format. Returns null when the record has no file (or storage is
 * unreachable) — callers then fall back to the standard workbook.
 */
async function downloadOriginalSf10File(
  url: string | null | undefined,
): Promise<OriginalSf10File | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = url.split(/[?#]/)[0] ?? url;
    const match = path.match(/\.([a-z0-9]+)$/i);
    const ext = match ? match[1].toLowerCase() : "";
    const headerMime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const mimeType =
      headerMime ||
      (ext === "pdf" ? SF10_PDF_MIME : ext === "xlsx" ? SF10_XLSX_MIME : "");
    return { buffer, ext, mimeType };
  } catch (e) {
    logger.warn({ err: e }, "[sf10-autofill] could not fetch the original file");
    return null;
  }
}

// Interactive-tx budget: hosted DB latency spikes past Prisma's 5s default.
const SF10_TX_OPTS = { timeout: 30_000, maxWait: 15_000 };

export async function getSummary() {
  const archivedLearners = await archivedAdvisoryLearnerIds();
  const records = await prisma.sf10Record.findMany({
    where: { student: excludeArchivedProfiles(archivedLearners) },
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

  const [studentsWithoutRecord, rosterLrns, profileLrns] = await Promise.all([
    prisma.studentProfile.groupBy({
      by: ["gradeLevel"],
      where: { sf10Records: { none: {} }, ...excludeArchivedProfiles(archivedLearners) },
      _count: { _all: true },
    }),
    prisma.studentRoster.findMany({
      where: excludeArchivedRosters(archivedLearners),
      select: { lrn: true, gradeLevel: true },
    }),
    prisma.studentProfile.findMany({
      where: excludeArchivedProfiles(archivedLearners),
      select: { lrn: true },
    }),
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
  desk: "registrar" | "record_keeper" | null;
  page: number;
  pageSize: number;
  q: string;
  status: "attach" | "available" | "released" | null;
}

export async function listRecords(query: RecordsQuery) {
  const { desk, page, pageSize, q, status } = query;
  const archivedLearners = await archivedAdvisoryLearnerIds();
  // Each desk sees only the records it filed — never the other desk's.
  const deskWhere =
    desk != null
      ? ({ desk } as Prisma.Sf10RecordWhereInput)
      : ({} as Prisma.Sf10RecordWhereInput);
  const studentClause = { student: excludeArchivedProfiles(archivedLearners) };

  const where: Prisma.Sf10RecordWhereInput = {
    ...deskWhere,
    ...studentClause,
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
      where: { ...deskWhere, ...studentClause },
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
        desk: true,
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
            section: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);
  const countBy = { attach: 0, available: 0, released: 0 };
  for (const c of counts) countBy[c.status] = c._count._all;

  // Adviser access is a separate grant (adviser-access desk), not an SF10
  // lifecycle step — surface it per record so the board never mistakes a
  // granted read-access for a cross-school release. A grant is either
  // per-LRN (approvedLrns) or a whole-request approval for the section.
  const pageLrns = records.map((r) => r.student.lrn);
  const pageSectionIds = records
    .map((r) => r.student.section?.id)
    .filter((id): id is string => !!id);
  const accessRows =
    pageLrns.length > 0
      ? await prisma.adviserSf10AccessRequest.findMany({
          where: {
            OR: [
              { approvedLrns: { hasSome: pageLrns } },
              ...(pageSectionIds.length > 0
                ? [{ status: "approved" as const, sectionId: { in: pageSectionIds } }]
                : []),
            ],
          },
          select: { approvedLrns: true, sectionId: true, status: true },
        })
      : [];
  const accessLrns = new Set(accessRows.flatMap((r) => r.approvedLrns ?? []));
  const accessSectionIds = new Set(
    accessRows.filter((r) => r.status === "approved").map((r) => r.sectionId),
  );
  const hasAdviserAccess = (r: (typeof records)[number]) =>
    accessLrns.has(r.student.lrn) ||
    (r.student.section ? accessSectionIds.has(r.student.section.id) : false);

  return {
    records: records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      desk: r.desk,
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
      adviserAccess: hasAdviserAccess(r),
    })),
    total,
    page,
    pageSize,
    counts: { ...countBy, total: countBy.attach + countBy.available + countBy.released },
  };
}

export interface OcrSubjectPayload {
  rawName: string;
  norm: string;
  grade?: number | null;
  /** Final rating. Null/0 = blank → NOT TAKEN (policy); any score = taken. */
  rating?: number | null;
  /** Grade the row belongs to (G7..G12). Null = untagged → current grade only. */
  gradeLevel?: string | null;
  /** Quarterly ratings Q1–Q4 in column order, if read. */
  quarters?: Array<number | null> | null;
  /** SHS only: per-semester finals [1st sem, 2nd sem], if read. */
  semFinals?: Array<number | null> | null;
  /** PASSED / FAILED … as printed, if read. */
  remarks?: string | null;
}

export interface OcrLearnerPayload {
  lrn: string | null;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  suffix: string | null;
  fullName: string | null;
}

export interface OcrPayload {
  subjects: OcrSubjectPayload[];
  /** Learner read from the file itself (Learner's Information block). */
  learner: OcrLearnerPayload | null;
  rawTextPreview?: string;
  confidence: number;
  engine: string;
  ocrAt: string;
  needsReview: boolean;
  /** Photo OCR state: "processing" fills subjects in later via local OCR. */
  ocrStatus?: "ready" | "processing";
  /** File rendered from this payload (auto-fill), kept with the version. */
  generatedFileUrl?: string;
}

async function storeOcrPayload(
  recordId: string,
  userId: string,
  payload: OcrPayload,
  reason: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.sf10Record.findUnique({
      where: { id: recordId },
      select: { id: true, ocrExtractedData: true, currentVersion: true },
    });
    if (!record) return 0;
    // `currentVersion` can lag behind the version table on records uploaded by
    // the older upload path, so take the higher of the two as the base.
    const latest = await tx.sf10RecordVersion.findFirst({
      where: { sf10RecordId: recordId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersion = Math.max(record.currentVersion, latest?.versionNumber ?? 0) + 1;
    await tx.sf10Record.update({
      where: { id: recordId },
      data: {
        ocrExtractedData: payload as unknown as Prisma.InputJsonValue,
        currentVersion: nextVersion,
      },
    });
    await tx.sf10RecordVersion.create({
      data: {
        sf10RecordId: recordId,
        versionNumber: nextVersion,
        dataSnapshot: payload as unknown as Prisma.InputJsonValue,
        changedBy: userId,
        changeReason: reason,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        actionType: "sf10_update",
        sourceTable: "sf10_records",
        sourceId: recordId,
        reason,
      },
    });
    return nextVersion;
  }, SF10_TX_OPTS);
}

export interface LocalExtraction {
  payload: OcrPayload;
  subjects: OcrSubjectPayload[];
  learner: LearnerIdentity;
  rawText: string;
}

/**
 * Extraction-first: read subjects + learner off the file itself (XLSX cells
 * or PDF text — no OCR worker needed), ready to store synchronously.
 */
export async function buildLocalPayload(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<LocalExtraction> {
  if (isXlsxUpload(file.mimetype, file.originalname)) {
    const grid = await extractXlsxGrid(file.buffer);
    const subjects = (isShsForm(grid) ? extractSubjectsFromGridShs(grid) : extractSubjectsFromGrid(grid)).map((s) => ({
      rawName: s.rawName,
      norm: s.norm,
      grade: s.rating,
      rating: s.rating,
      gradeLevel: s.gradeLevel,
      quarters: s.quarters,
      semFinals: s.semFinals ?? null,
      remarks: s.remarks,
    }));
    const learner = extractIdentityFromCells(grid);
    const rawText = grid.map((r) => r.join(" ")).join("\n").slice(0, 20_000);
    const payload: OcrPayload = {
      subjects,
      learner,
      rawTextPreview: rawText.slice(0, 2000),
      confidence: rawText.length > 20 ? 0.9 : 0.2,
      engine: "local-xlsx-v1",
      ocrAt: new Date().toISOString(),
      needsReview: subjects.length === 0,
    };
    return { payload, subjects, learner, rawText };
  }
  if (file.mimetype === "application/pdf") {
    const rawText = extractPdfText(file.buffer);
    const { extractRatedSubjectsFromText } = await import("./subject-aliases.js");
    const subjects = extractRatedSubjectsFromText(rawText).map((s) => ({
      rawName: s.rawName,
      norm: s.norm,
      grade: s.rating,
      rating: s.rating,
      gradeLevel: s.gradeLevel,
      quarters: s.quarters,
      remarks: s.remarks,
    }));
    const learner = extractIdentityFromText(rawText);
    // No digital text but embedded photos: local OCR fills this in.
    const needsPhotoOcr = subjects.length === 0 && pdfHasImages(file.buffer);
    const payload: OcrPayload = {
      subjects,
      learner,
      rawTextPreview: rawText.slice(0, 2000),
      confidence: rawText.length > 50 ? 0.65 : 0.2,
      engine: "local-pdf-text-v1",
      ocrAt: new Date().toISOString(),
      needsReview: subjects.length === 0,
      ocrStatus: needsPhotoOcr ? "processing" : "ready",
    };
    return { payload, subjects, learner, rawText };
  }
  if (isImageUpload(file.mimetype, file.originalname)) {
    // Phone/direct photos: subjects arrive via background local OCR.
    const learner: LearnerIdentity = {
      lrn: null,
      lastName: null,
      firstName: null,
      middleName: null,
      suffix: null,
      fullName: null,
      confidence: 0,
    };
    const payload: OcrPayload = {
      subjects: [],
      learner,
      confidence: 0,
      engine: "local-ocr-queued",
      ocrAt: new Date().toISOString(),
      needsReview: true,
      ocrStatus: "processing",
    };
    return { payload, subjects: [], learner, rawText: "" };
  }
  const learner: LearnerIdentity = {
    lrn: null,
    lastName: null,
    firstName: null,
    middleName: null,
    suffix: null,
    fullName: null,
    confidence: 0,
  };
  const payload: OcrPayload = {
    subjects: [],
    learner,
    confidence: 0,
    engine: "none-image-needs-worker",
    ocrAt: new Date().toISOString(),
    needsReview: true,
    ocrStatus: "ready",
  };
  return { payload, subjects: [], learner, rawText: "" };
}

/**
 * Worker enrichment for files local extraction cannot read (scanned
 * images/PDFs) — fills the payload later when OCR_WORKER_URL is set.
 */
function runWorkerEnrichment(input: {
  recordId: string;
  userId: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}) {
  void (async () => {
    try {
      const worker = await tryWorker(input.buffer, input.mimetype, input.originalname);
      if (!worker) return;
      const record = await prisma.sf10Record.findUnique({
        where: { id: input.recordId },
        select: { ocrExtractedData: true },
      });
      const prior = record?.ocrExtractedData as unknown as OcrPayload | null;
      const { extractRatedSubjectsFromText } = await import("./subject-aliases.js");
      const subjects = extractRatedSubjectsFromText(worker.rawText).map((s) => ({
        rawName: s.rawName,
        norm: s.norm,
        grade: s.rating,
        rating: s.rating,
        gradeLevel: s.gradeLevel,
        quarters: s.quarters,
        remarks: s.remarks,
      }));
      await storeOcrPayload(
        input.recordId,
        input.userId,
        {
          subjects,
          learner: prior && typeof prior === "object" ? (prior.learner ?? null) : null,
          rawTextPreview: worker.rawText.slice(0, 2000),
          confidence: worker.confidence,
          engine: worker.engine,
          ocrAt: new Date().toISOString(),
          needsReview: subjects.length === 0,
        },
        "SF10 worker OCR enrichment",
      );
    } catch (e) {
      logger.warn({ err: e, recordId: input.recordId }, "[sf10-ocr] worker enrichment failed");
    }
  })();
}

/**
 * Background photo OCR for files stored as "processing" (scanned PDFs and
 * direct photos). Fills subjects + learner, then the detail page stops
 * polling on its own. Failures land in needs-review instead of hanging.
 */
function runLocalOcr(input: {
  recordId: string;
  userId: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}) {
  void (async () => {
    try {
      const result = await withTimeout(
        ocrFileToSubjects({ buffer: input.buffer, mimetype: input.mimetype, originalname: input.originalname }),
        OCR_TIMEOUT_MS,
        "photo OCR",
      );
      const record = await prisma.sf10Record.findUnique({
        where: { id: input.recordId },
        select: { ocrExtractedData: true },
      });
      const prior = record?.ocrExtractedData as unknown as OcrPayload | null;
      if (prior && Array.isArray(prior.subjects) && prior.subjects.length > 0) return;
      if (!result || (result.subjects.length === 0 && !result.learner.lrn)) {
        await storeOcrPayload(
          input.recordId,
          input.userId,
          {
            subjects: [],
            learner: prior && typeof prior === "object" ? (prior.learner ?? null) : null,
            confidence: 0,
            engine: "local-ocr-failed",
            ocrAt: new Date().toISOString(),
            needsReview: true,
            ocrStatus: "ready",
          },
          "SF10 photo OCR found nothing readable",
        );
        return;
      }
      await storeOcrPayload(
        input.recordId,
        input.userId,
        {
          subjects: result.subjects,
          learner: {
            lrn: result.learner.lrn,
            lastName: result.learner.lastName,
            firstName: result.learner.firstName,
            middleName: result.learner.middleName,
            suffix: result.learner.suffix,
            fullName: result.learner.fullName,
          },
          rawTextPreview: result.rawText.slice(0, 2000),
          confidence: result.confidence,
          engine: "local-ocr-tesseract-v1",
          ocrAt: new Date().toISOString(),
          needsReview: result.subjects.length === 0,
          ocrStatus: "ready",
        },
        "SF10 photo OCR",
      );
    } catch (e) {
      logger.warn({ err: e, recordId: input.recordId }, "[sf10-ocr] local OCR enrichment failed");
      try {
        await storeOcrPayload(
          input.recordId,
          input.userId,
          {
            subjects: [],
            learner: null,
            confidence: 0,
            engine: "local-ocr-failed",
            ocrAt: new Date().toISOString(),
            needsReview: true,
            ocrStatus: "ready",
          },
          "SF10 photo OCR failed",
        );
      } catch {
        // Record already shows needs-review; nothing more to do.
      }
    }
  })();
}

export interface UploadInput {
  studentId: string;
  file: { buffer: Buffer; originalname: string; mimetype: string };
}

/**
 * Upload-first learner detection: extract LRN + 4-part name from the file
 * itself, then match against enrolled profiles. No rows are written.
 */
export async function analyzeUpload(
  ctx: Sf10Context,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  let learner = isXlsxUpload(file.mimetype, file.originalname)
    ? extractIdentityFromCells(await extractXlsxGrid(file.buffer))
    : extractIdentityFromText(extractPdfText(file.buffer));
  if (!learner.lrn && !learner.fullName) {
    try {
      const ocr = await withTimeout(ocrFileToSubjects(file), OCR_TIMEOUT_MS, "photo OCR");
      if (ocr && (ocr.subjects.length > 0 || ocr.learner.lrn)) learner = ocr.learner;
    } catch (e) {
      logger.warn({ err: e }, "[sf10-ocr] analyze photo OCR failed");
    }
  }
  const { candidates, rosterOnlyLrn } = await matchLearnerCandidates(
    { userId: ctx.userId, role: ctx.role },
    learner,
  );
  return { learner, candidates, rosterOnlyLrn };
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

  const band = await resolveGradeBand(ctx.role, ctx.userId);
  if (band.length > 0 && !band.includes(student.gradeLevel)) {
    throw new AppError(403, "GRADE_SCOPE", "You do not handle this student's grade level");
  }

  const ext = file.originalname.split(".").pop() ?? "pdf";
  const path = sf10ObjectPath(studentId, ext);

  // Extraction first: read subjects + learner off the file before anything
  // is named or stored.
  const local = await buildLocalPayload(file);
  const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getSf10Bucket());

  const source = isRegistrar ? "manual" : "ocr_upload";
  const changeReason = isRegistrar ? "Manual registrar upload" : "Initial OCR upload";
  const auditReason = isRegistrar ? "SF10 uploaded by registrar" : "SF10 OCR upload";

  // Atomic: record (with extracted payload) + version + audit in one tx.
  // Filed under the uploader's own desk (one record per student per desk).
  const record = await prisma.$transaction(async (tx) => {
    const row = await storeSf10UploadTx(tx, {
      userId: ctx.userId,
      studentId,
      desk: deskForUpload(ctx.role, String(student.gradeLevel)),
      fileUrl,
      source,
      changeReason,
      auditReason,
      payload: local.payload,
    });
    return row;
  }, SF10_TX_OPTS);

  const ocrStatus = local.payload.ocrStatus ?? "ready";
  if (local.payload.ocrStatus === "processing") {
    runLocalOcr({
      recordId: record.id,
      userId: ctx.userId,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }
  if (getEnv().OCR_WORKER_URL?.trim() && local.subjects.length === 0) {
    runWorkerEnrichment({
      recordId: record.id,
      userId: ctx.userId,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }

  return {
    id: record.id,
    source: record.source,
    uploadedFileUrl: fileUrl,
    ocrStatus,
    learner: local.learner,
  };
}

type Sf10TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function storeSf10UploadTx(
  tx: Sf10TxClient,
  input: {
    userId: string;
    studentId: string;
    desk: "registrar" | "record_keeper";
    fileUrl: string;
    source: "manual" | "ocr_upload" | "auto_populated";
    changeReason: string;
    auditReason: string;
    payload?: OcrPayload | null;
  },
) {
  // One record per (student, desk): each desk files and keeps its own.
  const row = await tx.sf10Record.upsert({
    where: { studentId_desk: { studentId: input.studentId, desk: input.desk } },
    create: {
      studentId: input.studentId,
      desk: input.desk,
      source: input.source,
      // Storage model: an upload is stored as-is (attached). No approvals,
      // no middle state — release archives it straight from attached.
      status: "attach",
      uploadedFileUrl: input.fileUrl,
      uploadedAt: new Date(),
      validatedBy: null,
      validatedAt: null,
      ...(input.payload ? { ocrExtractedData: input.payload as unknown as Prisma.InputJsonValue } : {}),
    },
    update: {
      source: input.source,
      uploadedFileUrl: input.fileUrl,
      uploadedAt: new Date(),
      // Re-uploads stay stored as-is too — never kicked back to approvals.
      status: "attach",
      verifiedBy: null,
      verifiedAt: null,
      validatedBy: null,
      validatedAt: null,
      releasedAt: null,
      archivedAt: null,
      ...(input.payload ? { ocrExtractedData: input.payload as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  const existing = await tx.sf10RecordVersion.count({ where: { sf10RecordId: row.id } });
  const nextVersion = existing + 1;
  await tx.sf10RecordVersion.create({
    data: {
      sf10RecordId: row.id,
      versionNumber: nextVersion,
      dataSnapshot: (row.ocrExtractedData as object) ?? {},
      changedBy: input.userId,
      changeReason: input.changeReason,
    },
  });
  // Keep the record's pointer in sync so the next storeOcrPayload (auto-fill,
  // manual correction) appends a genuinely new version instead of reusing this
  // number and leaving `currentVersion` stale.
  await tx.sf10Record.update({
    where: { id: row.id },
    data: { currentVersion: nextVersion },
  });
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      actionType: "sf10_update",
      sourceTable: "sf10_records",
      sourceId: row.id,
      reason: input.auditReason,
    },
  });
  return row;
}

const AUTO_LINK_SCORE = 85;
const PROVISION_GRADES = ["G7", "G8", "G9", "G10", "G11", "G12"];

/** Highest grade seen anywhere in the file (subjects or section markers). */
function fileGradeCeiling(
  subjects: Array<{ gradeLevel?: string | null }>,
  markerLines: string[],
): string | null {
  const fromSubjects = maxGradeLevel(subjects.map((s) => s.gradeLevel ?? null));
  if (fromSubjects) return fromSubjects;
  const markers: string[] = [];
  for (const line of markerLines) {
    const classified = parseClassifiedGrade(line);
    if (classified) {
      markers.push(classified);
      continue;
    }
    const header = detectGradeLevelFromText(line);
    if (header) markers.push(header);
  }
  return maxGradeLevel(markers);
}

async function summarizeDeficiencies(
  subjects: OcrSubjectPayload[],
  studentGrade: string,
) {
  const idx = PROVISION_GRADES.indexOf(studentGrade);
  const grades = (idx >= 0 ? PROVISION_GRADES.slice(0, idx + 1) : [studentGrade]) as never[];
  const catalog = await prisma.subject.findMany({
    where: { gradeLevel: { in: grades } },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, gradeLevel: true, category: true },
  });
  const map = buildDeficiencyMap(
    catalog.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      gradeLevel: String(s.gradeLevel),
      category: String(s.category),
    })),
    subjects.map((s) => ({
      rawName: s.rawName,
      norm: s.norm,
      rating: s.rating ?? s.grade ?? null,
      gradeLevel: s.gradeLevel ?? null,
      quarters: s.quarters ?? null,
      semFinals: s.semFinals ?? null,
      remarks: s.remarks ?? null,
    })),
    studentGrade,
  );
  return map.deficiencies;
}

/**
 * No-picker upload. Extraction runs first: subjects + learner are read off
 * the file, the grade basis is the file's own "Classified as Grade" blocks,
 * and the report speaks in subjects — which grades the learner has not taken
 * each subject in. An unknown learner gets a student record from the file;
 * the grade is asked only when the file states none.
 */
export async function uploadAuto(
  ctx: Sf10Context,
  input: {
    file: { buffer: Buffer; originalname: string; mimetype: string };
    gradeLevel?: string | null;
  },
) {
  const { file } = input;
  // 1) Extraction first — everything downstream (naming, grading, report)
  // comes from the file, never from a picker.
  const local = await buildLocalPayload(file);
  if (local.subjects.length === 0) {
    // Scanned PDF or direct photo: read it now (slow) so learner, grade
    // basis, and subjects all come from the file as usual.
    try {
      const ocr = await withTimeout(ocrFileToSubjects(file), OCR_TIMEOUT_MS, "photo OCR");
      if (ocr && (ocr.subjects.length > 0 || ocr.learner.lrn)) {
        local.subjects = ocr.subjects;
        local.learner = ocr.learner;
        local.rawText = ocr.rawText;
        local.payload = {
          subjects: ocr.subjects,
          learner: {
            lrn: ocr.learner.lrn,
            lastName: ocr.learner.lastName,
            firstName: ocr.learner.firstName,
            middleName: ocr.learner.middleName,
            suffix: ocr.learner.suffix,
            fullName: ocr.learner.fullName,
          },
          rawTextPreview: ocr.rawText.slice(0, 2000),
          confidence: ocr.confidence,
          engine: "local-ocr-tesseract-v1",
          ocrAt: new Date().toISOString(),
          needsReview: ocr.subjects.length === 0,
          ocrStatus: "ready",
        };
      }
    } catch (e) {
      logger.warn({ err: e }, "[sf10-ocr] upload photo OCR failed");
    }
  }
  const { learner } = local;
  const markerLines = isXlsxUpload(file.mimetype, file.originalname)
    ? (await extractXlsxGrid(file.buffer)).map((r) => r.join(" "))
    : local.rawText.split(/\r?\n/);

  const { candidates } = await matchLearnerCandidates(
    { userId: ctx.userId, role: ctx.role },
    learner,
  );
  const top = candidates[0] ?? null;
  const confident = top && (top.matchKind === "lrn-exact" || top.score >= AUTO_LINK_SCORE);

  const isRegistrar = ctx.role === "registrar";
  const source = isRegistrar ? "manual" : "ocr_upload";
  const ext = file.originalname.split(".").pop() ?? "pdf";
  const band = await resolveGradeBand(ctx.role, ctx.userId);
  const assertBand = (gradeLevel: string) => {
    if (!canUploadGradeLevel(ctx.role, band as string[], gradeLevel)) {
      throw new AppError(403, "GRADE_SCOPE", "This record's grade level is outside your grade band");
    }
  };

  if (confident && top) {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: top.studentId },
      select: { userId: true, gradeLevel: true },
    });
    if (!student) throw new AppError(404, "NOT_FOUND", "Matched student no longer exists");
    assertBand(String(student.gradeLevel));
    const fileUrl = await uploadFile(file.buffer, sf10ObjectPath(student.userId, ext), file.mimetype, getSf10Bucket());
    const record = await prisma.$transaction(async (tx) => {
      return storeSf10UploadTx(tx, {
        userId: ctx.userId,
        studentId: student.userId,
        desk: deskForUpload(ctx.role, String(student.gradeLevel)),
        fileUrl,
        source,
        changeReason: "SF10 upload (learner read from file)",
        auditReason: `SF10 uploaded — ${learner.fullName ?? top.fullName} read from file (${top.matchKind})`,
        payload: local.payload,
      });
    }, SF10_TX_OPTS);
    if (local.payload.ocrStatus === "processing") {
      runLocalOcr({
        recordId: record.id,
        userId: ctx.userId,
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
    }
    if (getEnv().OCR_WORKER_URL?.trim() && local.subjects.length === 0) {
      runWorkerEnrichment({
        recordId: record.id,
        userId: ctx.userId,
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
    }
    const deficiencies = await summarizeDeficiencies(local.subjects, String(student.gradeLevel));
    return {
      id: record.id,
      source: record.source,
      uploadedFileUrl: fileUrl,
      ocrStatus: local.payload.ocrStatus ?? "ready",
      studentCreated: false,
      learner,
      matched: { kind: top.matchKind, score: top.score, fullName: top.fullName },
      gradeLevel: String(student.gradeLevel),
      deficiencies,
    };
  }

  // No confident match: the student record is created from the file. The
  // grade basis is the file's own "Classified as Grade" blocks (highest one
  // wins); the caller-supplied grade is only a fallback for files that state
  // none. Nothing here speaks of rosters — the report is about subjects.
  const fileGrade = fileGradeCeiling(local.subjects, markerLines);
  const fallback = input.gradeLevel?.toUpperCase() ?? null;
  const readGrade =
    fileGrade ?? (fallback && PROVISION_GRADES.includes(fallback) ? fallback : null);
  if (!readGrade) {
    throw new AppError(
      409,
      "NO_GRADE_IN_FILE",
      "The record's grade level ('Classified as Grade') could not be read from the file — select the grade this record covers.",
    );
  }
  // Registrar files a JHS completer as an incoming SHS learner (G11) so the
  // upload lands in the registrar's scope instead of the record-keeper's.
  const grade = provisionGradeForUpload(ctx.role, readGrade);
  assertBand(grade);
  if (!learner.lrn) {
    throw new AppError(409, "NEEDS_LRN", "No LRN could be read from the file — the record cannot be saved without it.");
  }

  // Hash outside the transaction (slow); the tx re-checks LRN for races.
  const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
  const email = `${learner.lrn}@sf10-provisioned.local`;
  const fullName = formatLearnerName(learner) ?? `LRN ${learner.lrn}`;
  const fileUrl = await uploadFile(
    file.buffer,
    sf10ObjectPath(`provision-${learner.lrn}`, ext),
    file.mimetype,
    getSf10Bucket(),
  );
  const record = await prisma.$transaction(async (tx) => {
    let studentId: string | null = null;
    const existingProfile = await tx.studentProfile.findUnique({
      where: { lrn: learner.lrn as string },
      select: { userId: true, gradeLevel: true },
    });
    if (existingProfile) {
      assertBand(String(existingProfile.gradeLevel));
      // Same uploader-scope rule as new provisions: a registrar re-upload
      // for a G10 learner moves them up to incoming SHS (G11), so the
      // record lands in the registrar's table instead of staying invisible
      // in the record-keeper's.
      const scopedGrade = provisionGradeForUpload(ctx.role, String(existingProfile.gradeLevel));
      if (scopedGrade !== String(existingProfile.gradeLevel)) {
        await tx.studentProfile.update({
          where: { userId: existingProfile.userId },
          data: { gradeLevel: scopedGrade as never },
        });
      }
      studentId = existingProfile.userId;
    } else {
      const stray = await tx.user.findUnique({ where: { email }, select: { id: true } });
      let userId: string;
      if (stray) {
        userId = stray.id;
      } else {
        try {
          const created = await tx.user.create({
            data: {
              email,
              passwordHash,
              role: "student",
              status: "active",
              fullName,
              lrn: learner.lrn,
            },
            select: { id: true },
          });
          userId = created.id;
        } catch (e) {
          // Lost a race with a concurrent upload of the same file: reuse.
          if ((e as { code?: string })?.code !== "P2002") throw e;
          const raced = await tx.user.findUnique({ where: { email }, select: { id: true } });
          if (!raced) throw e;
          userId = raced.id;
        }
      }
      try {
        const profile = await tx.studentProfile.create({
          data: {
            userId,
            lrn: learner.lrn as string,
            mascot: mascotFor(fullName, learner.lrn as string),
            gradeLevel: grade as never,
          },
          select: { userId: true },
        });
        studentId = profile.userId;
      } catch (e) {
        if ((e as { code?: string })?.code !== "P2002") throw e;
        const raced = await tx.studentProfile.findUnique({
          where: { lrn: learner.lrn as string },
          select: { userId: true, gradeLevel: true },
        });
        if (!raced) throw e;
        assertBand(String(raced.gradeLevel));
        studentId = raced.userId;
      }
      await tx.auditLog.create({
        data: {
          userId: ctx.userId,
          actionType: "create",
          sourceTable: "users",
          sourceId: userId,
          reason: `Student record created from SF10 file (LRN ${learner.lrn}, ${grade}) — stored, no approval needed`,
        },
      });
    }
    return storeSf10UploadTx(tx, {
      userId: ctx.userId,
      studentId: studentId as string,
      desk: deskForUpload(ctx.role, grade),
      fileUrl,
      source,
      changeReason: "SF10 upload (student record created from file)",
      auditReason: `SF10 uploaded — ${fullName} read from file (Grade ${grade.slice(1)})`,
      payload: local.payload,
    });
  }, SF10_TX_OPTS);
  if (getEnv().OCR_WORKER_URL?.trim() && local.subjects.length === 0) {
    runWorkerEnrichment({
      recordId: record.id,
      userId: ctx.userId,
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }
  const deficiencies = await summarizeDeficiencies(local.subjects, grade);
  return {
    id: record.id,
    source: record.source,
    uploadedFileUrl: fileUrl,
    ocrStatus: "ready" as const,
    studentCreated: true,
    learner,
    matched: null,
    gradeLevel: grade,
    deficiencies,
  };
}

export async function listVersions(ctx: Sf10Context, recordId: string) {
  await assertRecordAccess(recordId, ctx);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
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

export async function getOcrResult(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      desk: true,
      ocrExtractedData: true,
      source: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  await assertDeskAccess(record.desk, ctx, record.student.gradeLevel);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  const payload = record.ocrExtractedData as unknown as OcrPayload | null;
  const stored = payload && typeof payload === "object" ? payload.ocrStatus : undefined;
  const ocrStatus =
    stored === "processing"
      ? "processing"
      : payload && typeof payload === "object" && "subjects" in payload
        ? "ready"
        : "processing";
  return { id: record.id, ocrExtractedData: record.ocrExtractedData, source: record.source, ocrStatus };
}

export async function updateOcrSubjects(
  ctx: Sf10Context,
  recordId: string,
  subjects: Array<{
    rawName: string;
    grade?: number | null;
    rating?: number | null;
    gradeLevel?: string | null;
    quarters?: Array<number | null> | null;
    remarks?: string | null;
  }>,
) {
  const record = await assertRecordAccess(recordId, ctx);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  const validGrades = new Set(["G7", "G8", "G9", "G10", "G11", "G12"]);
  const cleanQuarters = (q: unknown): Array<number | null> | null => {
    if (!Array.isArray(q) || q.length !== 4) return null;
    if (!q.some((v) => typeof v === "number")) return null;
    return q.map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null));
  };
  const cleaned = subjects
    .map((s) => {
      const rating =
        typeof s.rating === "number" && Number.isFinite(s.rating)
          ? Math.round(s.rating)
          : typeof s.grade === "number" && Number.isFinite(s.grade)
            ? Math.round(s.grade)
            : null;
      const gradeLevel =
        typeof s.gradeLevel === "string" && validGrades.has(s.gradeLevel.toUpperCase())
          ? s.gradeLevel.toUpperCase()
          : null;
      const remarks =
        typeof s.remarks === "string" && s.remarks.trim() ? s.remarks.trim().slice(0, 20).toUpperCase() : null;
      return {
        rawName: String(s.rawName ?? "").trim().slice(0, 120),
        grade: rating,
        rating,
        gradeLevel,
        quarters: cleanQuarters(s.quarters),
        remarks,
      };
    })
    .filter((s) => s.rawName.length > 0)
    .slice(0, 120);
  if (cleaned.length === 0) throw new AppError(400, "BAD_REQUEST", "At least one subject is required");
  const { normalizeSubjectName } = await import("./subject-aliases.js");
  const prior = record.ocrExtractedData as unknown as OcrPayload | null;
  const payload: OcrPayload = {
    subjects: cleaned.map((s) => ({
      rawName: s.rawName,
      norm: normalizeSubjectName(s.rawName),
      grade: s.grade,
      rating: s.rating,
      gradeLevel: s.gradeLevel,
      quarters: s.quarters,
      remarks: s.remarks,
    })),
    learner: prior && typeof prior === "object" ? (prior.learner ?? null) : null,
    confidence: 1,
    engine: "manual-correction",
    ocrStatus: "ready",
    ocrAt: new Date().toISOString(),
    needsReview: false,
  };
  await storeOcrPayload(record.id, ctx.userId, payload, "SF10 subjects corrected manually");
  return { id: record.id, subjects: payload.subjects };
}

export interface AutoFillWriteResult {
  recordId: string;
  version: number;
  status: string;
  replaced: number;
  added: number;
  wasVerified: boolean;
}

/**
 * Merge grading-portal rows into an SF10 record for one grade level.
 *
 * Only the rows tagged with `gradeLevel` are replaced; prior years and untagged
 * add-on rows are kept. Every write still appends a version + audit through
 * `storeOcrPayload`, so the permanent record keeps its history. A verified
 * (`available`) record drops back to unverified so the records desk re-checks.
 */
export async function applyAutoFilledSubjects(
  ctx: Sf10Context,
  recordId: string,
  gradeLevel: string,
  rows: OcrSubjectPayload[],
): Promise<AutoFillWriteResult> {
  const record = await assertRecordAccess(recordId, ctx);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  if (record.status === "released") {
    throw new AppError(
      409,
      "SF10_RELEASED",
      "This SF10 record was already released and cannot be auto-filled.",
    );
  }

  const prior = record.ocrExtractedData as unknown as OcrPayload | null;
  const priorSubjects = prior && Array.isArray(prior.subjects) ? prior.subjects : [];
  const autoNorms = new Set(rows.map((r) => r.norm));
  const kept: OcrSubjectPayload[] = [];
  const priorNormsAtGrade = new Set<string>();
  let replaced = 0;

  for (const s of priorSubjects) {
    const sameGrade = (s.gradeLevel ?? null) === gradeLevel;
    if (sameGrade) priorNormsAtGrade.add(s.norm);
    if (sameGrade && autoNorms.has(s.norm)) {
      replaced += 1;
      continue;
    }
    kept.push(s);
  }
  const added = rows.filter((r) => !priorNormsAtGrade.has(r.norm)).length;

  const learner = await prisma.studentProfile.findUnique({
    where: { userId: record.studentId },
    select: { lrn: true, user: { select: { fullName: true } } },
  });

  // Auto-fill leaves a real updated file in the original's format: a patched
  // copy of the registrar/record-keeper workbook, or a PDF when the upload was
  // a PDF. Untouched grade blocks and every non-rating cell stay as uploaded.
  const generatedAt = new Date();
  const mergedSubjects = [...kept, ...rows];
  let generatedFileUrl: string | undefined;
  if (learner) {
    try {
      const original = await downloadOriginalSf10File(record.uploadedFileUrl);
      const rendered = await renderAutoFillFile({
        learnerName: learner.user.fullName,
        lrn: learner.lrn,
        gradeLevel,
        subjects: mergedSubjects,
        generatedAt,
        original,
        filled: rows.map((r) => ({
          norm: r.norm,
          rawName: r.rawName,
          gradeLevel: r.gradeLevel ?? gradeLevel,
          quarters: r.quarters ?? null,
          rating: r.rating ?? r.grade ?? null,
          remarks: r.remarks ?? null,
        })),
      });
      generatedFileUrl = await uploadFile(
        rendered.buffer,
        sf10ObjectPath(record.studentId, rendered.ext),
        rendered.mimeType,
        getSf10Bucket(),
      );
    } catch (e) {
      logger.warn(
        { err: e, recordId },
        "[sf10-autofill] could not render the updated file — keeping the previous file",
      );
    }
  }

  const payload: OcrPayload = {
    subjects: mergedSubjects,
    learner: prior?.learner ?? null,
    confidence: 1,
    engine: "grading-auto-fill-v1",
    ocrStatus: "ready",
    ocrAt: generatedAt.toISOString(),
    needsReview: false,
    ...(generatedFileUrl ? { generatedFileUrl } : {}),
  };

  const wasVerified = record.status === "available";
  const version = await storeOcrPayload(
    recordId,
    ctx.userId,
    payload,
    "SF10 auto-filled from adviser-approved finals",
  );
  if (wasVerified) {
    await prisma.sf10Record.update({
      where: { id: recordId },
      data: { verifiedBy: null, verifiedAt: null },
    });
  }
  return { recordId, version, status: record.status, replaced, added, wasVerified };
}

export async function getSubjectMap(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      desk: true,
      ocrExtractedData: true,
      source: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  await assertDeskAccess(record.desk, ctx, record.student.gradeLevel);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  const schoolSubjects = await prisma.subject.findMany({
    where: { gradeLevel: record.student.gradeLevel },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true },
  });
  const payload = record.ocrExtractedData as unknown as OcrPayload | null;
  const ocrSubjects =
    payload && typeof payload === "object" && Array.isArray(payload.subjects)
      ? payload.subjects.map((s) => ({
          rawName: s.rawName,
          norm: s.norm,
          grade: s.grade ?? s.rating ?? null,
          rating: s.rating ?? s.grade ?? null,
          gradeLevel: s.gradeLevel ?? null,
          quarters: s.quarters ?? null,
          semFinals: s.semFinals ?? null,
          remarks: s.remarks ?? null,
        }))
      : [];
  // Current-grade view only: rows tagged with the student's grade. Other
  // years belong to their grade sections; untagged rows are add-ons.
  const currentGradeSubjects = ocrSubjects.filter(
    (s) => s.gradeLevel === record.student.gradeLevel,
  );
  const map = buildSubjectMap(schoolSubjects, currentGradeSubjects);
  // Per-year deficiency: catalog for every grade up to the student's current
  // grade (strict per-grade match, no cross-grade credit; rating null/0 =
  // not taken, any other score = taken).
  const gradeOrder = ["G7", "G8", "G9", "G10", "G11", "G12"];
  const currentIdx = gradeOrder.indexOf(record.student.gradeLevel);
  const grades = currentIdx >= 0 ? gradeOrder.slice(0, currentIdx + 1) : [record.student.gradeLevel];
  const fullCatalog = await prisma.subject.findMany({
    where: { gradeLevel: { in: grades as never[] } },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, gradeLevel: true, category: true },
  });
  const deficiency = buildDeficiencyMap(
    fullCatalog.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      gradeLevel: String(s.gradeLevel),
      category: String(s.category),
    })),
    ocrSubjects,
    record.student.gradeLevel,
  );
  const storedStatus = payload && typeof payload === "object" ? payload.ocrStatus : undefined;
  return {
    id: record.id,
    gradeLevel: record.student.gradeLevel,
    ocrStatus:
      storedStatus === "processing"
        ? "processing"
        : payload && typeof payload === "object" && "subjects" in payload
          ? "ready"
          : "processing",
    confidence: payload?.confidence ?? 0,
    learner: payload && typeof payload === "object" ? (payload.learner ?? null) : null,
    schoolSubjectCount: schoolSubjects.length,
    ocrSubjectCount: ocrSubjects.length,
    ...map,
    perGrade: deficiency.perGrade,
    deficiencies: deficiency.deficiencies,
    addons: deficiency.addons,
    coverage: deficiency.coverage,
    needsReview: map.needsReview || deficiency.deficiencies.length > 0 || (payload?.needsReview ?? true),
  };
}

/** Single-record detail for the dedicated report page: header + versions + map. */
export async function getRecordDetail(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      studentId: true,
      desk: true,
      source: true,
      status: true,
      uploadedFileUrl: true,
      uploadedAt: true,
      verifiedBy: true,
      verifiedAt: true,
      verifiedByUser: { select: { fullName: true } },
      validatedBy: true,
      validatedAt: true,
      validatedByUser: { select: { fullName: true } },
      releasedAt: true,
      archivedAt: true,
      currentVersion: true,
      updatedAt: true,
      student: {
        select: {
          lrn: true,
          user: { select: { fullName: true } },
          gradeLevel: true,
          section: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  await assertDeskAccess(record.desk, ctx, record.student.gradeLevel);
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  const [versions, map, adviserAccessCount] = await Promise.all([
    listVersions(ctx, record.id),
    getSubjectMap(ctx, record.id),
    // Read access granted on the adviser-access desk is tracked separately
    // from the SF10 lifecycle status (release = issued to another school).
    // Per-LRN grants and whole-request section approvals both count.
    prisma.adviserSf10AccessRequest.count({
      where: {
        OR: [
          { approvedLrns: { has: record.student.lrn } },
          ...(record.student.section
            ? [
                {
                  status: "approved" as const,
                  sectionId: record.student.section.id,
                },
              ]
            : []),
        ],
      },
    }),
  ]);
  return {
    record: {
      id: record.id,
      studentId: record.studentId,
      desk: record.desk,
      lrn: record.student.lrn,
      fullName: record.student.user.fullName,
      gradeLevel: record.student.gradeLevel,
      section: record.student.section?.name ?? "—",
      source: record.source,
      status: record.status,
      uploadedFileUrl: record.uploadedFileUrl,
      uploadedAt: record.uploadedAt,
      verifiedBy: record.verifiedBy,
      verifiedByName: record.verifiedByUser?.fullName ?? null,
      verifiedAt: record.verifiedAt,
      validatedBy: record.validatedBy,
      validatedByName: record.validatedByUser?.fullName ?? null,
      validatedAt: record.validatedAt,
      releasedAt: record.releasedAt,
      archivedAt: record.archivedAt,
      currentVersion: record.currentVersion,
      updatedAt: record.updatedAt,
      adviserAccess: adviserAccessCount > 0,
    },
    versions: versions.versions,
    map,
  };
}

export async function verifyRecord(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      desk: true,
      status: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  if (record.status === "released") {
    throw new AppError(409, "BAD_STATUS", "This record is released & archived — verification is closed");
  }
  if (ctx.role === "adviser") await assertAdviserSf10Access(ctx.userId, recordId);
  // Desk roles stamp records too (record-keeper / registrar) — keep them
  // inside their own desk scope.
  if (deskForRole(ctx.role)) await assertDeskAccess(record.desk, ctx, record.student.gradeLevel);
  const updated = await prisma.sf10Record.update({ where: { id: record.id }, data: { verifiedBy: ctx.userId, verifiedAt: new Date() } });

  void (async () => {
    try {
      const full = await prisma.sf10Record.findUnique({
        where: { id: record.id },
        select: {
          student: {
            select: {
              user: { select: { fullName: true } },
              section: { select: { name: true, adviserId: true } },
            },
          },
        },
      });
      const name = full?.student.user.fullName ?? "A student";
      const section = full?.student.section?.name ?? "—";
      await fanoutToRole(record.desk, {
        sourceTable: "sf10_records",
        action: "verified",
        message: `SF10 verified: ${name} (${section}) — needs validation.`,
        sourceId: record.id,
        excludeUserId: ctx.userId,
      });
      const adviserId = full?.student.section?.adviserId ?? null;
      if (adviserId && adviserId !== ctx.userId) {
        await fanoutNotification({
          userId: adviserId,
          sourceTable: "sf10_records",
          action: "validate",
          message: `SF10 verified for your advisee ${name} (${section}) — ready for validation.`,
          sourceId: record.id,
        });
      }
    } catch {

    }
  })();
  return updated;
}

/**
 * Desk-side validation stamp: the record-keeper / registrar confirms the
 * filed record is good to release. Independent of verification (either
 * stamp can land first); released records are closed to both.
 */
export async function validateRecord(ctx: Sf10Context, recordId: string) {
  const record = await prisma.sf10Record.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      desk: true,
      status: true,
      student: { select: { gradeLevel: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "SF10 record not found");
  await assertDeskAccess(record.desk, ctx, record.student.gradeLevel);
  if (record.status === "released") {
    throw new AppError(409, "BAD_STATUS", "This record is released & archived — validation is closed");
  }
  const updated = await prisma.sf10Record.update({
    where: { id: record.id },
    data: { validatedBy: ctx.userId, validatedAt: new Date() },
  });

  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "sf10_records",
    action: "validate_self",
    message: `You validated an SF10 record — ready for release.`,
    sourceId: record.id,
  });
  void (async () => {
    try {
      const full = await prisma.sf10Record.findUnique({
        where: { id: record.id },
        select: {
          student: {
            select: {
              user: { select: { fullName: true } },
              section: { select: { name: true, adviserId: true } },
            },
          },
        },
      });
      const adviserId = full?.student.section?.adviserId ?? null;
      const name = full?.student.user.fullName ?? "your advisee";
      const section = full?.student.section?.name ?? "—";
      if (adviserId && adviserId !== ctx.userId) {
        await fanoutNotification({
          userId: adviserId,
          sourceTable: "sf10_records",
          action: "validate",
          message: `SF10 validated for your advisee ${name} (${section}).`,
          sourceId: record.id,
        });
      }
    } catch { /* best-effort */ }
  })();
  return updated;
}

export async function releaseRecord(ctx: Sf10Context, recordId: string) {
  const record = await assertRecordAccess(recordId, ctx);
  if (record.status !== "attach") throw new AppError(409, "BAD_STATUS", "Only attached records can be released");
  const now = new Date();
  const studentSection = await prisma.sf10Record.findUnique({
    where: { id: record.id },
    select: { student: { select: { user: { select: { fullName: true } }, section: { select: { name: true, adviserId: true } } } } },
  });
  const updated = await prisma.$transaction([
    prisma.sf10Record.update({
      where: { id: record.id },
      data: { status: "released", releasedAt: now, archivedAt: now },
    }),
    prisma.auditLog.create({ data: { userId: ctx.userId, actionType: "sf10_update", sourceTable: "sf10_records", sourceId: record.id, reason: "SF10 released and archived" } }),
  ]);

  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "sf10_records",
    action: "release_self",
    message: `You released an SF10 record — archived.`,
    sourceId: record.id,
  });
  void (async () => {
    try {
      const adviserId = studentSection?.student.section?.adviserId ?? null;
      const name = studentSection?.student.user.fullName ?? "your advisee";
      if (adviserId && adviserId !== ctx.userId) {
        await fanoutNotification({
          userId: adviserId,
          sourceTable: "sf10_records",
          action: "validate",
          message: `SF10 released for your advisee ${name} — archived and ready.`,
          sourceId: record.id,
        });
      }
    } catch { /* best-effort */ }
  })();
  return updated[0];
}
