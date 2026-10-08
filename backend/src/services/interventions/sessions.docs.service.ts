import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { ensureDocsUnlocked, formatSessionDoc, getIntervention, getInterventionSession } from "../../modules/interventions/interventions.repository.js";
import type { InterventionContext } from "./intervention.types.js";

export async function listAttachments(ctx: InterventionContext, interventionId: string, sessionId: string) {
  const row = await getIntervention(interventionId, ctx.termId);
  const session = await getInterventionSession(row.id, sessionId);
  const rows = await prisma.clinicSessionAttachment.findMany({
    where: { sessionId: session.id },
    orderBy: { uploadedAt: "asc" },
  });
  return rows.map(formatSessionDoc);
}

export interface SessionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  files: SessionFile[],
) {
  const row = await getIntervention(interventionId, ctx.termId);

  if (row.outcomeStatus === "unresolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a discontinued follow-up");
  }
  const session = await getInterventionSession(row.id, sessionId);
  ensureDocsUnlocked(session);
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.clinicSessionAttachment.count({
    where: { sessionId: session.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
  }
  const created = await Promise.all(
    files.map(async (file) => {
      const path = clinicSessionObjectPath(session.id, file.originalname);
      const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
      return prisma.clinicSessionAttachment.create({
        data: {
          sessionId: session.id,
          fileUrl,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: ctx.userId,
        },
      });
    })
  );
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });

  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "session_attachments",
      action: "create",
      message: "Session documentation was added to your follow-up.",
      sourceId: row.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "create_self",
    message: "You added session photos to a follow-up.",
    sourceId: row.id,
  });
  return created.map(formatSessionDoc);
}

export async function removeAttachment(
  ctx: InterventionContext,
  interventionId: string,
  sessionId: string,
  attachmentId: string,
) {
  const row = await getIntervention(interventionId, ctx.termId);
  if (row.outcomeStatus === "unresolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a discontinued follow-up");
  }
  const session = await getInterventionSession(row.id, sessionId);
  const doc = await prisma.clinicSessionAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!doc || doc.sessionId !== session.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.clinicSessionAttachment.delete({ where: { id: doc.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `Documentation removed: ${doc.fileName}`,
    oldValue: { fileName: doc.fileName },
    newValue: null,
  });

  if (row.assignedTo && row.assignedTo !== ctx.userId) {
    void fanoutNotification({
      userId: row.assignedTo,
      sourceTable: "session_attachments",
      action: "delete",
      message: "Session documentation was removed from your follow-up.",
      sourceId: row.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "delete_self",
    message: "You removed a session photo from a follow-up.",
    sourceId: row.id,
  });
  return { ok: true };
}
