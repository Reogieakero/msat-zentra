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
  termId?: string;
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

  const filingTermId = ctx.termId ?? String(input.termId ?? "");
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

export async function addFollowup(ctx: AnecdotalContext, recordId: string, notes: string) {
  const record = await prisma.anecdotalRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
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
      section: { select: { adviserId: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
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
