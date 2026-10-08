import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { clinicSessionObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { ensureSessionStarted, formatAttachment, getSession, getSessionReferral, referralCard } from "../../modules/referrals/referrals.repository.js";
import type { ReferralContext } from "./referral.types.js";

export async function listAttachments(ctx: ReferralContext, referralId: string, sessionId: string) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  const session = await getSession(referral.id, sessionId);
  const rows = await prisma.clinicSessionAttachment.findMany({
    where: { sessionId: session.id },
    orderBy: { uploadedAt: "asc" },
  });
  return rows.map(formatAttachment);
}

export interface SessionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  files: SessionFile[],
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a closed case");
  }
  const session = await getSession(referral.id, sessionId);

  if (session.status === "scheduled") {
    ensureSessionStarted(session);
  }
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.clinicSessionAttachment.count({
    where: { sessionId: session.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A session can hold at most 10 documentation images");
  }
  const created = [];
  for (const file of files) {
    const path = clinicSessionObjectPath(session.id, file.originalname);
    const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
    const row = await prisma.clinicSessionAttachment.create({
      data: {
        sessionId: session.id,
        fileUrl,
        fileName: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: ctx.userId,
      },
    });
    created.push(row);
  }
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });
  const card = await referralCard(referral);

  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "session_attachments",
      action: "create",
      message: `Session documentation was added for ${card.who}.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "create_self",
    message: `You added session photos for ${card.who}.`,
    sourceId: referral.id,
  });
  return created.map(formatAttachment);
}

export async function removeAttachment(
  ctx: ReferralContext,
  referralId: string,
  sessionId: string,
  attachmentId: string,
) {
  const referral = await getSessionReferral(referralId, ctx.role, ctx.termId);
  if (referral.status === "resolved" || referral.status === "dismissed") {
    throw new AppError(400, "INVALID_ACTION", "Cannot remove documentation from a closed case");
  }
  const session = await getSession(referral.id, sessionId);
  const row = await prisma.clinicSessionAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!row || row.sessionId !== session.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.clinicSessionAttachment.delete({ where: { id: row.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "session_document_added",
    sourceTable: "counseling_sessions",
    sourceId: session.id,
    reason: `Documentation removed: ${row.fileName}`,
    oldValue: { fileName: row.fileName },
    newValue: null,
  });
  const card = await referralCard(referral);

  if (referral.referredBy && referral.referredBy !== ctx.userId) {
    void fanoutNotification({
      userId: referral.referredBy,
      sourceTable: "session_attachments",
      action: "delete",
      message: `Session documentation was removed for ${card.who}.`,
      sourceId: referral.id,
    });
  }
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "session_attachments",
    action: "delete_self",
    message: `You removed a session photo for ${card.who}.`,
    sourceId: referral.id,
  });
  return { ok: true };
}
