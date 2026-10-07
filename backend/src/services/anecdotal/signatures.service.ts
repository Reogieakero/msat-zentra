import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import { parseSignatureDataUrl } from "../../modules/anecdotal/anecdotal.repository.js";
import { AppError } from "../../lib/errors.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export async function getSignature(userId: string) {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { signatureImageUrl: true },
  });
  return { imageUrl: profile?.signatureImageUrl ?? null };
}

export async function saveSignature(ctx: AnecdotalContext, signatureImage: string) {
  let image: Buffer;
  try {
    image = parseSignatureDataUrl(signatureImage);
  } catch (e) {
    throw new AppError(400, "BAD_SIGNATURE", (e as Error).message);
  }
  const imageUrl = `data:image/png;base64,${image.toString("base64")}`;
  const profile = await prisma.staffProfile.upsert({
    where: { userId: ctx.userId },
    update: { signatureImageUrl: imageUrl },
    create: {
      userId: ctx.userId,
      employeeId: `T-${ctx.userId.slice(0, 8)}`,
      signatureImageUrl: imageUrl,
    },
    select: { signatureImageUrl: true },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "staff_profiles",
    sourceId: ctx.userId,
    reason: "Teacher signature saved",
  });
  return { imageUrl: profile.signatureImageUrl };
}

// Stamp the teacher's saved signature onto one record (same signatory rule
// as drawing directly). 409 when the teacher hasn't saved one yet.
export async function applySignature(ctx: AnecdotalContext, recordId: string) {
  const [record, profile] = await Promise.all([
    prisma.anecdotalRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        observerId: true,
        section: { select: { adviserId: true } },
      },
    }),
    prisma.staffProfile.findUnique({
      where: { userId: ctx.userId },
      select: { signatureImageUrl: true },
    }),
  ]);
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const maySign =
    record.section.adviserId === ctx.userId ||
    (!record.section.adviserId && record.observerId === ctx.userId);
  if (!maySign) {
    throw new AppError(403, "FORBIDDEN", "Only the section adviser may sign this form");
  }
  if (!profile?.signatureImageUrl) {
    throw new AppError(409, "NO_SIGNATURE", "Save your signature first, then apply it.");
  }
  const signed = await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: {
      signedBy: ctx.userId,
      signedAt: new Date(),
      signatureImageUrl: profile.signatureImageUrl,
    },
    select: { id: true, signedBy: true, signedAt: true, signatureImageUrl: true },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "OCForm-01 signed (saved signature applied)",
  });
  return signed;
}

// Drawn-signature sign-off for one record. Only the signatory may sign: the
// section adviser, or the observer when no adviser is assigned (same rule
// that picks the printed name). Re-signing overwrites the previous mark.
export async function signRecord(ctx: AnecdotalContext, recordId: string, signatureImage: string) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      observerId: true,
      section: { select: { adviserId: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const maySign =
    record.section.adviserId === ctx.userId ||
    (!record.section.adviserId && record.observerId === ctx.userId);
  if (!maySign) {
    throw new AppError(403, "FORBIDDEN", "Only the section adviser may sign this form");
  }
  let image: Buffer;
  try {
    image = parseSignatureDataUrl(signatureImage);
  } catch (e) {
    throw new AppError(400, "BAD_SIGNATURE", (e as Error).message);
  }
  // No storage bucket is provisioned yet, so the PNG data URL itself is
  // stored on the row (small canvas PNGs only — capped by the parser).
  // If a bucket is added later, upload here and store the public URL;
  // readers already accept both data: and https: URLs.
  const imageUrl = `data:image/png;base64,${image.toString("base64")}`;
  const signed = await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { signedBy: ctx.userId, signedAt: new Date(), signatureImageUrl: imageUrl },
    select: { id: true, signedBy: true, signedAt: true, signatureImageUrl: true },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "OCForm-01 signed",
  });
  return signed;
}

// Remove a signature (same signatory rule). The form returns to unsigned.
export async function removeSignature(ctx: AnecdotalContext, recordId: string) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      observerId: true,
      section: { select: { adviserId: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const maySign =
    record.section.adviserId === ctx.userId ||
    (!record.section.adviserId && record.observerId === ctx.userId);
  if (!maySign) {
    throw new AppError(403, "FORBIDDEN", "Only the section adviser may remove this signature");
  }
  await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { signedBy: null, signedAt: null, signatureImageUrl: null },
  });
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: record.id,
    reason: "OCForm-01 signature removed",
  });
  return { id: record.id, signed: false };
}
