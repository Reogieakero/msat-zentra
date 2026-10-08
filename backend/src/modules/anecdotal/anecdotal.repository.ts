import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { OcForm01Data } from "./ocform01.service.js";
import {
  buildOcForm01Buffer,
  ocForm01Filename,
  parseSignatureDataUrl,
} from "./ocform01.service.js";
import { GRADE_LABELS as GRADE_LABEL_OC } from "../../lib/grades.js";

export { GRADE_LABEL_OC, buildOcForm01Buffer, ocForm01Filename, parseSignatureDataUrl };

export const FILER_ROLES = ["adviser", "subject_teacher"] as const;

export const OCFORM01_ROLES = [
  "adviser",
  "subject_teacher",
  "guidance_counselor",
  "principal",
  "nurse",
  "adm_coordinator",
] as const;

export const CATEGORY_KEYS = ["behavioral", "bullying", "academic", "attendance", "health"] as const;
export const CATEGORY_META: Record<
  string,
  { label: string; color: string }
> = {
  behavioral: { label: "Behavioral", color: "#166534" },
  bullying: { label: "Bullying", color: "#b91c1c" },
  academic: { label: "Academic", color: "#1d4ed8" },
  attendance: { label: "Attendance", color: "#c2410c" },
  health: { label: "Health", color: "#7c3aed" },
};

export async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  return u?.fullName ?? "Someone";
}

export async function assertOwnFolder(folderId: string, ownerId: string) {
  const folder = await prisma.anecdotalFolder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true },
  });
  if (!folder || folder.ownerId !== ownerId) {
    throw new AppError(404, "FOLDER_NOT_FOUND", "Folder not found");
  }
  return folder;
}

export async function loadOcForm01Data(recordId: string, requesterId: string, requesterRole: string): Promise<{
  data: OcForm01Data;
  filename: string;
  recordId: string;
  canSign: boolean;
  signature: { by: string; at: string; imageUrl: string } | null;
}> {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    include: {
      observer: { select: { fullName: true } },
      student: {
        select: {
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      },
      roster: {
        select: {
          gradeLevel: true,
          fullName: true,
        },
      },
      section: {
        select: {
          name: true,
          adviserId: true,
          adviser: { select: { fullName: true } },
        },
      },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");

  const isObserver = record.observerId === requesterId;
  const isSectionAdviser = record.section.adviserId === requesterId;
  const isPrincipal = requesterRole === "principal";
  const isGuidance = requesterRole === "guidance_counselor";
  const isNurse = requesterRole === "nurse";
  const isAdmCoordinator = requesterRole === "adm_coordinator";
  if (!isObserver && !isSectionAdviser && !isPrincipal && !isGuidance && !isNurse && !isAdmCoordinator) {
    throw new AppError(403, "FORBIDDEN", "Only the observer, section adviser, principal, guidance counselor, school nurse, or ADM coordinator may open the official form");
  }
  if (isGuidance && !isObserver && !isSectionAdviser) {
    const referral = await prisma.referral.findFirst({
      where: {
        anecdotalRecordId: recordId,
        OR: [
          { referredToRole: "guidance_counselor" },
          {
            referredToRole: "adm_coordinator",
            admProfiles: { none: {} },
            OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
          },
        ],
      },
      select: { id: true },
    });
    if (!referral) {
      throw new AppError(403, "FORBIDDEN", "Only cases referred to guidance may be opened by the guidance counselor");
    }
  }

  if (isNurse && !isObserver && !isSectionAdviser) {
    const referral = await prisma.referral.findFirst({
      where: {
        anecdotalRecordId: recordId,
        OR: [
          { referredToRole: "nurse" },
          { status: "escalated", escalatedTo: "nurse" },
          {
            referredToRole: "adm_coordinator",
            consultReviewer: "nurse",
            admProfiles: { none: {} },
          },
        ],
      },
      select: { id: true },
    });
    if (!referral) {
      throw new AppError(403, "FORBIDDEN", "Only cases referred to the clinic may be opened by the school nurse");
    }
  }

  if (isAdmCoordinator && !isObserver && !isSectionAdviser) {
    const referral = await prisma.referral.findFirst({
      where: {
        anecdotalRecordId: recordId,
        referredToRole: "adm_coordinator",
      },
      select: { id: true },
    });
    if (!referral) {
      throw new AppError(403, "FORBIDDEN", "Only cases referred to ADM may be opened by the ADM coordinator");
    }
  }

  const studentGrade = record.student?.gradeLevel ?? record.roster?.gradeLevel;
  const gradeLabel = (studentGrade && GRADE_LABEL_OC[studentGrade]) ?? studentGrade ?? "";
  const gradeSection = `${gradeLabel} - ${record.section.name}`;
  const when = record.observationDatetime;

  let signature: { by: string; at: string; imageUrl: string } | null = null;
  let signatureImage: Uint8Array | undefined;
  if (record.signedBy && record.signedAt && record.signatureImageUrl) {
    const signer = await prisma.user.findUnique({
      where: { id: record.signedBy },
      select: { fullName: true },
    });
    signature = {
      by: signer?.fullName ?? "Adviser",
      at: record.signedAt.toISOString(),
      imageUrl: record.signatureImageUrl,
    };
    signatureImage = await loadSignatureBytes(record.signatureImageUrl);
  }

  const data: OcForm01Data = {
    observerName: record.observer.fullName,
    gradeSection,
    observationDate: when.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }),
    observationTime: when.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }),
    studentName: record.student?.user.fullName ?? record.roster?.fullName ?? "",
    descriptionOfIncident: record.descriptionOfIncident,
    descriptionOfLocation: record.descriptionOfLocation ?? "",
    notesRecommendationsActions: record.notesRecommendationsActions ?? "",
    classPerformance: record.classPerformance ?? "",
    attendanceSummary: record.attendanceSummary ?? "",
    adviserName: record.section.adviser?.fullName ?? record.observer.fullName,
    signatureImage,
  };

  const canSign =
    isSectionAdviser || (!record.section.adviserId && isObserver);
  return {
    data,
    filename: ocForm01Filename(data.studentName, when),
    recordId: record.id,
    canSign,
    signature,
  };
}

export async function loadSignatureBytes(imageUrl: string): Promise<Uint8Array | undefined> {
  try {
    if (imageUrl.startsWith("data:")) {
      return parseSignatureDataUrl(imageUrl);
    }
    const res = await fetch(imageUrl);
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 2_000_000) return undefined;
    return buffer;
  } catch {
    return undefined;
  }
}
