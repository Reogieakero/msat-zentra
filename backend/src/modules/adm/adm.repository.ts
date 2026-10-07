import { prisma } from "../../lib/prisma.js";
import type { AdmStage } from "../../services/adm.js";

// Shared ADM data-access: labels, desk pagination, evidence-form
// bookkeeping, actor lookup, and meeting row helpers used by more than one
// service. Single-table Prisma reads/writes that belong to exactly one
// service live in that service file instead.

export const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const ELIGIBILITY_LABEL: Record<string, string> = {
  pending: "For Review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

/* Desk-level pagination standard: full list pages = 15, overview previews
   page at the same list size (or 10). Backend accepts both `pageSize` (new)
   and `limit` (legacy) and clamps lists to 15 by default; wide summary reads
   may request up to 200. */
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

/* Freshly-signed cases stay put in the intake-facing views for this many
   days after the Principal's signature instead of vanishing from the
   coordinator's tables the moment they leave the pipeline. */
export const RECENT_APPROVAL_DAYS = 7;

/* Display name of the acting user for handoff messages — one lookup per
   call site, "Someone" fallback so a deleted/renamed account never blanks
   the notification. */
export async function actorName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  return u?.fullName ?? "Someone";
}

// Evidence-chain bookkeeping: AdmForm rows are the trackable face of case
// records (referral filed, anecdotal filed, minutes logged, home visit
// done, certification issued). They are materialized from the
// authoritative records at the moment the coordinator acts — verified,
// because the source record provably exists — so the Evidence chain,
// eligibility buckets, and principal signing all read the same truth.
// Idempotent per (profile, formType).
export type AdmFormKind =
  | "REFERRAL_FORM"
  | "ANECDOTAL_REPORT"
  | "MINUTES_OF_MEETING"
  | "HV_FORM"
  | "CERTIFICATION";

// The `db` param lets callers run the check inside their own transaction
// (e.g. profile creation) — defaults to the global client otherwise.
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

/* Invited staff on a parent meeting — id + name + role for the meeting card,
   the reschedule prefill, and invitee reminder routing. */
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
