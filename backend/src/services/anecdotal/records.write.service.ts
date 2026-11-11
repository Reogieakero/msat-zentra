import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { recomputeRisk, recomputeRosterRisk } from "../risk.js";
import { assertOwnFolder } from "../../modules/anecdotal/anecdotal.repository.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export interface CreateRecordInput {
  studentId: string;
  sectionId: string;
  observationDatetime: string;
  descriptionOfIncident: string;
  descriptionOfLocation?: string;
  notesRecommendationsActions?: string;
  classPerformance?: string;
  attendanceSummary?: string;
  category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  confidentialityLevel: "restricted" | "confidential";
  folderId?: string;
}

export async function createRecord(ctx: AnecdotalContext, input: CreateRecordInput) {
  /* GCForm-01 is filed by the section adviser only. */
  if (ctx.role !== "adviser") {
    throw new AppError(403, "FORBIDDEN", "Only the adviser may file a GCForm-01 record");
  }

  if (input.folderId) {
    const folder = await prisma.anecdotalFolder.findUnique({
      where: { id: input.folderId },
      select: { ownerId: true },
    });
    if (!folder || folder.ownerId !== ctx.userId) {
      throw new AppError(404, "FOLDER_NOT_FOUND", "Folder not found");
    }
  }

  const rawStudentId = String(input.studentId);
  const isRoster = rawStudentId.startsWith("roster:");
  const rosterId = isRoster ? rawStudentId.slice("roster:".length) : null;
  if (isRoster) {
    const entry = await prisma.studentRoster.findUnique({
      where: { id: rosterId as string },
      select: { sectionId: true },
    });
    if (!entry || entry.sectionId !== String(input.sectionId)) {
      throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found in this section");
    }
  }

  // The filing term is the caller's resolved scope only — a client-supplied
  // term can never redirect where a record is filed.
  const filingTermId = ctx.termId;
  if (!filingTermId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term to file under");
  }
  const record = await prisma.anecdotalRecord.create({
    data: {
      ...input,
      termId: filingTermId,
      studentId: isRoster ? null : rawStudentId,
      rosterId,
      observationDatetime: new Date(input.observationDatetime),
      observerId: ctx.userId,
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "anecdotal_edit", sourceTable: "anecdotal_records", sourceId: record.id, reason: "Anecdotal record created" });

  if (isRoster && rosterId) {
    await recomputeRosterRisk(rosterId, record.termId);
  } else {
    await recomputeRisk(rawStudentId, record.termId);
  }

  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "anecdotal_records",
    action: "create_self",
    message: "You filed an anecdotal record.",
    sourceId: record.id,
  });
  return { id: record.id, folderId: record.folderId ?? null };
}

export interface UpdateRecordInput {
  observationDatetime?: string;
  descriptionOfIncident?: string;
  descriptionOfLocation?: string | null;
  notesRecommendationsActions?: string | null;
  classPerformance?: string | null;
  attendanceSummary?: string | null;
  category?: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  confidentialityLevel?: "restricted" | "confidential";
}

/** The observer or the section adviser may edit / delete / restore a record. */
async function loadManageableRecord(recordId: string) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      observerId: true,
      studentId: true,
      rosterId: true,
      termId: true,
      deletedAt: true,
      section: { select: { adviserId: true } },
      _count: { select: { referrals: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  return record;
}

function assertCanManage(
  ctx: AnecdotalContext,
  record: { observerId: string; section: { adviserId: string | null } },
) {
  const allowed =
    record.observerId === ctx.userId || record.section.adviserId === ctx.userId;
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Only the observer or section adviser may manage this record");
  }
}

export async function updateRecord(
  ctx: AnecdotalContext,
  recordId: string,
  input: UpdateRecordInput,
) {
  const record = await loadManageableRecord(recordId);
  if (record.deletedAt) {
    throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  }
  assertCanManage(ctx, record);

  const updated = await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: {
      ...input,
      // An empty edit field clears the value instead of storing "".
      observationDatetime: input.observationDatetime
        ? new Date(input.observationDatetime)
        : undefined,
      // The signature signs the form's contents — an edit invalidates it, so
      // the adviser must apply it again once the record is final.
      signedBy: null,
      signedAt: null,
      signatureImageUrl: null,
    },
    select: { id: true },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "Anecdotal record edited",
  });
  return { id: updated.id, updated: true };
}

export async function deleteRecord(ctx: AnecdotalContext, recordId: string) {
  const record = await loadManageableRecord(recordId);
  if (record.deletedAt) return { id: record.id, deleted: true };
  assertCanManage(ctx, record);
  // A referral owns its source record: deleting it would orphan the case, so
  // the teacher must dismiss/finish the referral first.
  if (record._count.referrals > 0) {
    throw new AppError(
      409,
      "RECORD_HAS_REFERRAL",
      "This record is linked to a referral and cannot be deleted.",
    );
  }

  await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { deletedAt: new Date(), deletedBy: ctx.userId },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "Anecdotal record deleted (soft)",
  });

  // A deleted record no longer counts toward the behavioural risk factor.
  if (record.rosterId) await recomputeRosterRisk(record.rosterId, record.termId);
  else if (record.studentId) await recomputeRisk(record.studentId, record.termId);
  return { id: record.id, deleted: true };
}

export async function restoreRecord(ctx: AnecdotalContext, recordId: string) {
  const record = await loadManageableRecord(recordId);
  assertCanManage(ctx, record);
  if (!record.deletedAt) return { id: record.id, restored: true };

  await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { deletedAt: null, deletedBy: null },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "Anecdotal record restored",
  });

  if (record.rosterId) await recomputeRosterRisk(record.rosterId, record.termId);
  else if (record.studentId) await recomputeRisk(record.studentId, record.termId);
  return { id: record.id, restored: true };
}

export async function addFollowup(ctx: AnecdotalContext, recordId: string, notes: string) {
  const record = await prisma.anecdotalRecord.findUnique({ where: { id: recordId } });
  if (!record || record.deletedAt) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const followup = await prisma.anecdotalRecordFollowup.create({
    data: { anecdotalRecordId: record.id, followupBy: ctx.userId, followupDate: new Date(), notes },
  });
  await fanoutNotification({
    userId: record.observerId, sourceTable: "anecdotal_record_followups", action: "create",
    message: "New follow-up added to an anecdotal record.", sourceId: followup.id,
  });
  return followup;
}

export interface FileFolderInput {
  folderId: string | null;
}

export async function fileIntoFolder(
  ctx: AnecdotalContext,
  recordId: string,
  input: FileFolderInput,
) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      observerId: true,
      deletedAt: true,
      section: { select: { adviserId: true } },
    },
  });
  if (!record || record.deletedAt) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const allowed =
    record.observerId === ctx.userId ||
    record.section.adviserId === ctx.userId;
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Only the observer or section adviser may file this record");
  }
  const folderId: string | null = input.folderId;
  if (folderId) await assertOwnFolder(folderId, ctx.userId);
  const updated = await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { folderId },
    select: { id: true, folderId: true },
  });
  return updated;
}
