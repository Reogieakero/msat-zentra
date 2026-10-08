import { prisma } from "../../lib/prisma.js";
import type { AdmStage } from "../../services/adm.js";
import { GRADE_LABELS as GRADE_LABEL } from "../../lib/grades.js";

export { GRADE_LABEL };

export const ELIGIBILITY_LABEL: Record<string, string> = {
  pending: "For Review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

export const PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 200;

export function resolvePageSize(req: { query: unknown }): number {
  const q = req.query as Record<string, unknown>;
  const raw =
    typeof q.pageSize !== "undefined" ? Number(q.pageSize) : Number(q.limit);
  if (!Number.isFinite(raw) || (raw as number) <= 0) return PAGE_SIZE;
  return Math.min(Math.floor(raw as number), MAX_PAGE_SIZE);
}

export const REFERRAL_STAGES: AdmStage[] = [
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
];

export const ENROLLED_STAGES: AdmStage[] = [
  "enrollment_monitoring",
  "completion",
];

export const RECENT_APPROVAL_DAYS = 7;

export async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  return u?.fullName ?? "Someone";
}

export type AdmFormKind =
  | "REFERRAL_FORM"
  | "ANECDOTAL_REPORT"
  | "MINUTES_OF_MEETING"
  | "HV_FORM"
  | "CERTIFICATION";

export type AdmFormClient = Pick<typeof prisma, "admForm">;

export async function ensureAdmForm(
  profileId: string,
  formType: AdmFormKind,
  title: string,
  uploadedBy: string,
  db: AdmFormClient = prisma,
): Promise<void> {
  const existing = await db.admForm.findFirst({
    where: { admLearnerProfileId: profileId, formType },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== "verified") {
      await db.admForm.update({
        where: { id: existing.id },
        data: { status: "verified" },
      });
    }
    return;
  }
  await db.admForm.create({
    data: {
      admLearnerProfileId: profileId,
      formType,
      title,
      status: "verified",
      uploadedBy,
      notes: "Auto-recorded from the case evidence.",
    },
  });
}

export const meetingInviteeInclude = {
  invitees: {
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { invitedAt: "asc" as const },
  },
} as const;

export function meetingInviteeList(m: {
  invitees?: { user: { id: string; fullName: string; role: string } }[];
}): { id: string; fullName: string; role: string }[] {
  return (m.invitees ?? []).map((i) => ({
    id: i.user.id,
    fullName: i.user.fullName,
    role: i.user.role,
  }));
}

export function formatMeetingAttachment(a: {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
}) {
  return {
    id: a.id,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    uploadedAt: a.uploadedAt.toISOString(),
  };
}
