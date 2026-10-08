import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { admMeetingObjectPath, getReferralBucket, uploadFile } from "../../lib/storage.js";
import { formatMeetingAttachment } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

async function getDocumentableMeeting(meetingId: string) {
  const meeting = await prisma.admParentMeeting.findUnique({
    where: { id: meetingId },
    include: {
      referral: { select: { status: true } },
      admLearnerProfile: { select: { referral: { select: { status: true } } } },
    },
  });
  if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
  const status =
    meeting.referral?.status ??
    meeting.admLearnerProfile?.referral?.status ??
    null;
  if (status === "dismissed" || status === "resolved") {
    throw new AppError(400, "INVALID_ACTION", "Cannot add documentation to a closed case");
  }
  if (!meeting.attended && meeting.meetingDatetime.getTime() > Date.now()) {
    throw new AppError(
      400,
      "SESSION_NOT_STARTED",
      "This meeting hasn't started yet — documentation unlocks once the scheduled time arrives"
    );
  }
  return meeting;
}

export interface MeetingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function addAttachments(ctx: AdmContext, meetingId: string, files: MeetingFile[]) {
  const meeting = await getDocumentableMeeting(meetingId);
  if (files.length === 0) {
    throw new AppError(400, "BAD_REQUEST", "Attach at least one image");
  }
  const existing = await prisma.admMeetingAttachment.count({
    where: { meetingId: meeting.id },
  });
  if (existing + files.length > 10) {
    throw new AppError(400, "BAD_REQUEST", "A meeting can hold at most 10 documentation images");
  }
  const created = [];
  for (const file of files) {
    const path = admMeetingObjectPath(meeting.id, file.originalname);
    const fileUrl = await uploadFile(file.buffer, path, file.mimetype, getReferralBucket());
    const row = await prisma.admMeetingAttachment.create({
      data: {
        meetingId: meeting.id,
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
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `${created.length} documentation image${created.length === 1 ? "" : "s"} filed`,
    oldValue: null,
    newValue: { count: created.length },
  });
  return created.map(formatMeetingAttachment);
}

export async function removeAttachment(ctx: AdmContext, meetingId: string, attachmentId: string) {
  const meeting = await getDocumentableMeeting(meetingId);
  const row = await prisma.admMeetingAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!row || row.meetingId !== meeting.id) {
    throw new AppError(404, "NOT_FOUND", "Documentation not found");
  }
  await prisma.admMeetingAttachment.delete({ where: { id: row.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "adm_edit",
    sourceTable: "adm_parent_meetings",
    sourceId: meeting.id,
    reason: `Documentation removed: ${row.fileName}`,
    oldValue: { fileName: row.fileName },
    newValue: null,
  });
  return { ok: true };
}
